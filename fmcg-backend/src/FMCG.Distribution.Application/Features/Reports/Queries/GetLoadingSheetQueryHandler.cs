// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetLoadingSheetQueryHandler.cs

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Reports.DTOs;
using FMCG.Distribution.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using PdfUnit = QuestPDF.Infrastructure.Unit;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetLoadingSheetQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetLoadingSheetQuery, Result<byte[]>>
{
    // Loading workers get a highlighted alert once a route's 50kg bag count reaches this.
    private const int FiftyKgBagThreshold = 110;

    public async Task<Result<byte[]>> Handle(GetLoadingSheetQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var targetDate = request.Date?.Date ?? DateTime.UtcNow.Date;

            // ── Get all orders with Closed status for the target date ──
            var closedOrdersQuery = context.Orders
                .Include(o => o.Customer)
                .Include(o => o.Route)
                .Include(o => o.Items!)
                    .ThenInclude(i => i.Product!)
                        .ThenInclude(p => p.SizeGroup)
                .Include(o => o.Items!)
                    .ThenInclude(i => i.Unit)
                .Where(o => !o.IsDeleted
                    && (o.Status == OrderStatus.Closed || o.IsLocked)
                    && o.OrderDate.Date == targetDate.Date);

            if (request.RouteId.HasValue)
            {
                closedOrdersQuery = closedOrdersQuery.Where(o => o.RouteId == request.RouteId.Value);
            }

            var closedOrders = await closedOrdersQuery.ToListAsync(cancellationToken);

            if (closedOrders.Count == 0)
            {
                var emptyPdf = GenerateEmptyLoadingSheet(
                    targetDate,
                    request.RouteId.HasValue ? "No closed orders found for the selected route/date." : "No closed orders found for this date."
                );
                return Result<byte[]>.Success(emptyPdf);
            }

            // ── Group orders by route ──
            var routeGroups = closedOrders
                .Where(o => o.Route != null)
                .GroupBy(o => new { o.RouteId, RouteName = o.Route?.Name ?? "Unknown" })
                .OrderBy(g => g.Key.RouteName)
                .ToList();

            // ── Get unit priorities ──
            var units = await context.ProductUnits
                .Where(u => !u.IsDeleted)
                .ToDictionaryAsync(u => u.Id, u => u.LoadingPriority, cancellationToken);

            var routeSummaries = new List<LoadingSheetRouteSummaryDto>();

            foreach (var routeGroup in routeGroups)
            {
                var routeOrders = routeGroup.ToList();

                // ── Build item summary for this route (kept for API back-compat; not shown in the new PDF layout) ──
                var itemSummaryDict = new Dictionary<string, LoadingSheetItemSummaryDto>();

                // ── Build size-group summary for this route (e.g. "50 KG - 250 Bags"), heaviest first ──
                var sizeGroupSummaryDict = new Dictionary<string, LoadingSheetSizeGroupSummaryDto>();

                foreach (var order in routeOrders)
                {
                    if (order.Items == null) continue;

                    foreach (var item in order.Items)
                    {
                        if (item.Product == null) continue;

                        var key = item.ProductId.ToString();
                        var unitName = item.Unit?.Name ?? string.Empty;

                        if (!itemSummaryDict.TryGetValue(key, out var existingSummary))
                        {
                            existingSummary = new LoadingSheetItemSummaryDto
                            {
                                ProductName = item.Product.NameEnglish,
                                ProductNameMalayalam = item.Product.NameMalayalam,
                                UnitSymbol = item.Unit?.Symbol ?? string.Empty,
                                UnitTypeLabel = GetUnitTypeLabel(unitName),
                                LoadingPriority = units.GetValueOrDefault(item.UnitId, 99),
                                TotalQuantity = 0,
                                TotalBags = 0,
                                TotalBoxes = 0,
                                TotalTins = 0
                            };
                            itemSummaryDict[key] = existingSummary;
                        }

                        existingSummary.TotalQuantity += item.Quantity;

                        // ── Size-group rollup ──
                        var sizeGroupName = item.Product.SizeGroup?.Name;
                        if (!string.IsNullOrWhiteSpace(sizeGroupName))
                        {
                            if (!sizeGroupSummaryDict.TryGetValue(sizeGroupName, out var sgSummary))
                            {
                                sgSummary = new LoadingSheetSizeGroupSummaryDto
                                {
                                    SizeGroupName = sizeGroupName,
                                    SortKey = ParseSizeGroupSortKey(sizeGroupName),
                                    UnitTypeLabel = GetUnitTypeLabel(unitName),
                                    TotalQuantity = 0
                                };
                                sizeGroupSummaryDict[sizeGroupName] = sgSummary;
                            }
                            sgSummary.TotalQuantity += item.Quantity;
                        }
                    }
                }

                // ── Build customer stops (in admin-assigned delivery sequence) ──
                var stops = new List<LoadingSheetStopDto>();
                var routeTotalQty = 0m;

                var orderedOrders = routeOrders
                    .OrderBy(o => o.Customer?.SequenceOrder ?? 0)
                    .ToList();

                int stopNumber = 1;
                var runningFiftyKgBags = 0;
                var announcedMilestoneCount = 0;

                foreach (var order in orderedOrders)
                {
                    if (order.Customer == null || order.Items == null) continue;

                    var groupedItems = order.Items
                        .Where(i => i.Product != null)
                        .GroupBy(i => new
                        {
                            i.ProductId,
                            ProductName = i.Product!.NameEnglish,
                            ProductNameMl = i.Product.NameMalayalam,
                            i.UnitId,
                            UnitSymbol = i.Unit?.Symbol ?? string.Empty,
                            SizeGroupName = i.Product.SizeGroup?.Name,
                        })
                        .Select(g => new LoadingSheetItemDto
                        {
                            ProductName = g.Key.ProductName,
                            ProductNameMalayalam = g.Key.ProductNameMl,
                            UnitSymbol = g.Key.UnitSymbol,
                            TotalQuantity = g.Sum(i => i.Quantity),
                            LoadingPriority = units.GetValueOrDefault(g.Key.UnitId, 99),
                            UnitTypeLabel = GetUnitTypeLabel(g.Key.UnitSymbol),
                            SizeGroupName = g.Key.SizeGroupName,
                            SizeGroupSortKey = ParseSizeGroupSortKey(g.Key.SizeGroupName),
                            QuantityBags = 0,
                            QuantityBoxes = 0,
                            QuantityTins = 0,
                        })
                        // ── Size Group Prioritization: heaviest size group first, then loading priority, then name ──
                        .OrderBy(i => i.SizeGroupSortKey)
                        .ThenBy(i => i.LoadingPriority)
                        .ThenBy(i => i.ProductName)
                        .ToList();

                    var stopTotal = groupedItems.Sum(i => i.TotalQuantity);
                    routeTotalQty += stopTotal;

                    // ── 50kg bag threshold tracking ──
                    var fiftyKgBagsThisStop = order.Items
                        .Where(i => Is50KgSizeGroup(i.Product?.SizeGroup?.Name))
                        .Sum(i => i.QuantityBags ?? (int)i.Quantity);
                    runningFiftyKgBags += fiftyKgBagsThisStop;

                    // ── Repeats every time cumulative bags cross another multiple of the threshold ──
                    var currentMilestoneCount = runningFiftyKgBags / FiftyKgBagThreshold;
                    var crossedMilestones = new List<int>();
                    for (var m = announcedMilestoneCount + 1; m <= currentMilestoneCount; m++)
                    {
                        crossedMilestones.Add(m * FiftyKgBagThreshold);
                    }
                    announcedMilestoneCount = Math.Max(announcedMilestoneCount, currentMilestoneCount);

                    stops.Add(new LoadingSheetStopDto
                    {
                        CustomerId = order.Customer.Id,
                        CustomerName = order.Customer.NameEnglish,
                        CustomerNameMalayalam = order.Customer.NameMalayalam,
                        SequenceOrder = stopNumber,
                        LoadingPosition = stopNumber,
                        IsFirstDelivery = stopNumber == 1,
                        IsLastDelivery = stopNumber == orderedOrders.Count,
                        VisitStatus = VisitStatus.OrderPlaced,
                        Items = groupedItems,
                        StopTotalQuantity = stopTotal,
                        OrderNumber = order.OrderNumber,
                        Remarks = string.IsNullOrWhiteSpace(order.Remarks) ? null : order.Remarks,
                        FiftyKgThresholdMilestonesCrossed = crossedMilestones,
                        RunningFiftyKgBagTotal = runningFiftyKgBags,
                    });

                    stopNumber++;
                }

                routeSummaries.Add(new LoadingSheetRouteSummaryDto
                {
                    RouteId = routeGroup.Key.RouteId,
                    RouteName = routeGroup.Key.RouteName,
                    TotalOrders = routeOrders.Count,
                    TotalCustomers = stops.Count,
                    GrandTotalQuantity = routeTotalQty,
                    TotalBags = 0,
                    TotalBoxes = 0,
                    TotalTins = 0,
                    ItemSummary = itemSummaryDict.Values
                        .OrderBy(i => i.LoadingPriority)
                        .ThenBy(i => i.ProductName)
                        .ToList(),
                    SizeGroupSummary = sizeGroupSummaryDict.Values
                        .OrderBy(sg => sg.SortKey)
                        .ThenByDescending(sg => sg.TotalQuantity)
                        .ToList(),
                    Stops = stops
                });
            }

            var pdfBytes = GenerateSimpleLoadingSheetPdf(routeSummaries, targetDate, request.RouteId.HasValue);
            return Result<byte[]>.Success(pdfBytes);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LoadingSheet] Error: {ex.Message}");
            Console.WriteLine($"[LoadingSheet] StackTrace: {ex.StackTrace}");

            var errorPdf = GenerateEmptyLoadingSheet(
                request.Date?.Date ?? DateTime.UtcNow.Date,
                $"Error generating loading sheet: {ex.Message}"
            );
            return Result<byte[]>.Success(errorPdf);
        }
    }

    private static string GetUnitTypeLabel(string unitName)
    {
        if (string.IsNullOrEmpty(unitName)) return "OTHER";

        var name = unitName.ToLowerInvariant();
        if (name.Contains("bag")) return "BAGS";
        if (name.Contains("box")) return "BOXES";
        if (name.Contains("carton")) return "CARTONS";
        if (name.Contains("tin")) return "TINS";
        if (name.Contains("case")) return "CASES";
        if (name.Contains("piece") || name.Contains("pc")) return "PIECES";

        return "OTHER";
    }

    // ── Size Group Prioritization: parse leading number out of the group name ("50 KG" → 50) so
    // heavier groups sort first. Groups with no parseable number sort last. ──
    private static int ParseSizeGroupSortKey(string? sizeGroupName)
    {
        if (string.IsNullOrWhiteSpace(sizeGroupName)) return 999;
        var match = Regex.Match(sizeGroupName, @"\d+");
        if (match.Success && int.TryParse(match.Value, out var kg))
        {
            // Negative so ordering ascending by this key puts the heaviest (largest kg) first.
            return -kg;
        }
        return 999;
    }

    private static bool Is50KgSizeGroup(string? sizeGroupName)
        => sizeGroupName != null && Regex.IsMatch(sizeGroupName, @"\b50\s*kg\b", RegexOptions.IgnoreCase);

    // ── PDF Generator: order/customer table format, matching the Billing Sheet's style ──
    private static byte[] GenerateSimpleLoadingSheetPdf(
        List<LoadingSheetRouteSummaryDto> routes,
        DateTime targetDate,
        bool isSingleRoute)
    {
        try
        {
            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(0.5f, PdfUnit.Centimetre);
                    page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Times New Roman"));

                    // ── Header ──
                    page.Header()
                        .BorderBottom(0.5f)
                        .PaddingBottom(5)
                        .Row(row =>
                        {
                            row.RelativeItem().Column(col =>
                            {
                                col.Item().Text("LOADING SHEET").FontSize(16).Bold();
                                col.Item().Text($"Date: {targetDate:dd-MM-yyyy}").FontSize(10);
                                if (isSingleRoute && routes.Count == 1)
                                {
                                    col.Item().Text($"Route: {routes[0].RouteName}").FontSize(11).Bold();
                                }
                            });
                            row.RelativeItem().AlignRight().Column(col =>
                            {
                                col.Item().Text($"Generated: {DateTime.UtcNow:dd-MM-yyyy HH:mm}").FontSize(9);
                                if (isSingleRoute && routes.Count == 1)
                                {
                                    col.Item().Text($"Orders: {routes[0].TotalOrders} | Customers: {routes[0].TotalCustomers}").FontSize(9);
                                }
                                else
                                {
                                    var totalOrders = routes.Sum(r => r.TotalOrders);
                                    var totalStops = routes.Sum(r => r.TotalCustomers);
                                    col.Item().Text($"Routes: {routes.Count} | Orders: {totalOrders} | Stops: {totalStops}").FontSize(9);
                                }
                            });
                        });

                    // ── Content ──
                    page.Content().Column(contentCol =>
                    {
                        foreach (var route in routes)
                        {
                            contentCol.Item().PaddingTop(10).Column(routeCol =>
                            {
                                // ── Route Header ──
                                routeCol.Item().Background(Colors.Grey.Lighten2)
                                    .Padding(6)
                                    .Row(r =>
                                    {
                                        r.RelativeItem().Text($"{route.RouteName}").FontSize(13).Bold();
                                        r.RelativeItem().AlignRight().Text($"Orders: {route.TotalOrders}  |  Customers: {route.TotalCustomers}").FontSize(10);
                                    });

                                // ── Customer / Order table (Billing-Sheet style: #, Customer, Order#, Product, Qty) ──
                                routeCol.Item().PaddingTop(6).Table(table =>
                                {
                                    table.ColumnsDefinition(columns =>
                                    {
                                        columns.ConstantColumn(28);   // #
                                        columns.RelativeColumn(2.8f); // Customer
                                        columns.RelativeColumn(2.6f); // Order #
                                        columns.RelativeColumn(3.6f); // Product
                                        columns.RelativeColumn(1.4f); // Qty
                                    });

                                    table.Header(header =>
                                    {
                                        header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).Text("#").Bold().FontSize(10);
                                        header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).Text("CUSTOMER").Bold().FontSize(10);
                                        header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).Text("ORDER #").Bold().FontSize(10);
                                        header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).Text("PRODUCT").Bold().FontSize(10);
                                        header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).AlignRight().Text("QTY").Bold().FontSize(10);
                                    });

                                    foreach (var stop in route.Stops)
                                    {
                                        var firstRow = true;

                                        if (stop.Items.Count == 0 && stop.Remarks == null)
                                        {
                                            table.Cell().BorderBottom(0.5f).Padding(4).Text($"{stop.SequenceOrder}").Bold().FontSize(11);
                                            table.Cell().BorderBottom(0.5f).Padding(4).Text(stop.CustomerName).Bold().FontSize(11);
                                            table.Cell().BorderBottom(0.5f).Padding(4).Text(stop.OrderNumber ?? "").FontSize(9);
                                            table.Cell().BorderBottom(0.5f).Padding(4).Text("—").FontSize(10);
                                            table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text("").FontSize(10);
                                        }

                                        foreach (var item in stop.Items)
                                        {
                                            var borderBottom = (item == stop.Items.Last() && stop.Remarks == null) ? 0.5f : 0f;

                                            // # and Customer only printed once, on the first row of this stop
                                            table.Cell().Padding(4).BorderBottom(borderBottom).Text(firstRow ? $"{stop.SequenceOrder}" : "").Bold().FontSize(11);
                                            table.Cell().Padding(4).BorderBottom(borderBottom).Text(firstRow ? stop.CustomerName : "").Bold().FontSize(11);
                                            table.Cell().Padding(4).BorderBottom(borderBottom).Text(firstRow ? (stop.OrderNumber ?? "") : "").FontSize(9);
                                            table.Cell().Padding(4).BorderBottom(borderBottom).Text($"{item.ProductName}{(string.IsNullOrEmpty(item.SizeGroupName) ? "" : $"  ({item.SizeGroupName})")}").FontSize(10);
                                            table.Cell().Padding(4).BorderBottom(borderBottom).AlignRight().Text($"{item.TotalQuantity:N0} {item.UnitSymbol}").FontSize(10).Bold();

                                            firstRow = false;
                                        }

                                        // ── Retail items / remarks row — highlighted so warehouse staff know to weigh manually ──
                                        if (stop.Remarks != null)
                                        {
                                            table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).Text(firstRow ? $"{stop.SequenceOrder}" : "").Bold().FontSize(11);
                                            table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).Text(firstRow ? stop.CustomerName : "").Bold().FontSize(11);
                                            table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).Text(firstRow ? (stop.OrderNumber ?? "") : "").FontSize(9);
                                            table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).Text($"⚖ RETAIL / WEIGH: {stop.Remarks}").FontSize(10).Bold().FontColor(Colors.Orange.Darken2);
                                            table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).AlignRight().Text("").FontSize(10);
                                        }

                                        // ── 50kg bag threshold alert(s), inserted right after the stop that crossed them ──
                                        // Repeats every time cumulative bags cross another multiple (110, 220, 330...).
                                        foreach (var milestone in stop.FiftyKgThresholdMilestonesCrossed)
                                        {
                                            table.Cell().ColumnSpan(5).PaddingTop(8).PaddingBottom(4).Element(e => e);

                                            table.Cell().ColumnSpan(5).Background(Colors.Red.Lighten3).Padding(6)
                                                .Text($"⚠ ALERT: 50 KG BAGS HAVE REACHED {milestone}+ (RUNNING TOTAL: {stop.RunningFiftyKgBagTotal}) — AFTER \"{stop.CustomerName}\" — VERIFY LOADING CAPACITY")
                                                .Bold().FontSize(11).FontColor(Colors.Red.Darken2);

                                            table.Cell().ColumnSpan(5).PaddingTop(4).PaddingBottom(2).Element(e => e);
                                        }
                                    }
                                });

                                // ── Size Group Summary (end of route) — helps loaders plan bag counts by weight ──
                                if (route.SizeGroupSummary.Count > 0)
                                {
                                    routeCol.Item().PaddingTop(10)
                                        .Background(Colors.Blue.Lighten5)
                                        .Padding(8)
                                        .Column(sgCol =>
                                        {
                                            sgCol.Item().Text("📦 SIZE GROUP SUMMARY").FontSize(11).Bold();
                                            var i = 1;
                                            foreach (var sg in route.SizeGroupSummary)
                                            {
                                                sgCol.Item().PaddingTop(2).Text($"{i}. {sg.SizeGroupName} — {sg.TotalQuantity:N0} {sg.UnitTypeLabel}").FontSize(11).Bold();
                                                i++;
                                            }
                                        });
                                }

                                if (route != routes.Last())
                                {
                                    routeCol.Item().PageBreak();
                                }
                            });
                        }
                    });

                    // ── Footer ──
                    page.Footer()
                        .BorderTop(0.5f)
                        .PaddingTop(5)
                        .AlignCenter()
                        .Text(x =>
                        {
                            x.Span("Page ");
                            x.CurrentPageNumber();
                            x.Span(" of ");
                            x.TotalPages();
                            x.Span($"  |  Generated: {DateTime.UtcNow:HH:mm:ss}");
                        });
                });
            }).GeneratePdf();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LoadingSheet-PDF] Error: {ex.Message}");
            return GenerateEmptyLoadingSheet(targetDate, $"PDF generation error: {ex.Message}");
        }
    }

    private static byte[] GenerateEmptyLoadingSheet(DateTime targetDate, string message)
    {
        try
        {
            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(0.5f, PdfUnit.Centimetre);
                    page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Times New Roman"));

                    page.Header()
                        .BorderBottom(0.5f)
                        .PaddingBottom(5)
                        .Row(row =>
                        {
                            row.RelativeItem().Column(col =>
                            {
                                col.Item().Text("LOADING SHEET").FontSize(14).Bold();
                                col.Item().Text($"Date: {targetDate:dd-MM-yyyy}");
                            });
                            row.RelativeItem().AlignRight().Column(col =>
                            {
                                col.Item().Text($"Generated: {DateTime.UtcNow:dd-MM-yyyy HH:mm}");
                            });
                        });

                    page.Content()
                        .PaddingTop(40)
                        .AlignCenter()
                        .Column(col =>
                        {
                            col.Item().Text("⚠️ No Data Available").FontSize(14).Bold().FontColor(Colors.Orange.Medium);
                            col.Item().Text(message).FontSize(10).FontColor(Colors.Grey.Medium);
                            col.Item().PaddingTop(20).Text("Possible reasons:").FontSize(9).FontColor(Colors.Grey.Medium);
                            col.Item().Text("• No closed orders found for this route/date").FontSize(9).FontColor(Colors.Grey.Medium);
                            col.Item().Text("• Orders are still in Draft or Approved status").FontSize(9).FontColor(Colors.Grey.Medium);
                            col.Item().Text("• Admin must close orders before loading sheet generation").FontSize(9).FontColor(Colors.Grey.Medium);
                        });

                    page.Footer()
                        .BorderTop(0.5f)
                        .PaddingTop(5)
                        .AlignCenter()
                        .Text(x =>
                        {
                            x.Span("Page ");
                            x.CurrentPageNumber();
                            x.Span(" of ");
                            x.TotalPages();
                        });
                });
            }).GeneratePdf();
        }
        catch
        {
            return Array.Empty<byte>();
        }
    }
}