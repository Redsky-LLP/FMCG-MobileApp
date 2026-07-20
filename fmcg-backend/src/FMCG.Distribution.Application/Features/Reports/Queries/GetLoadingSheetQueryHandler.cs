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

    // ── PDF Generator: original block-per-stop layout (mirrors the Billing Sheet's style) —
    // route header, then one block per customer stop with a Product/Qty table underneath.
    // Order # is intentionally not shown anywhere in this layout, and retail/weigh remarks
    // are shown without the "RETAIL / WEIGH" label. ──
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
                        .Column(col =>
                        {
                            col.Item().Text("LOADING SHEET").FontSize(16).Bold();
                            col.Item().Text($"Date: {targetDate:dd-MM-yyyy}").FontSize(10);
                            if (isSingleRoute && routes.Count == 1)
                            {
                                col.Item().Text($"Route: {routes[0].RouteName}").FontSize(11).Bold();
                            }
                        });

                    // ── Content ──
                    page.Content().Column(contentCol =>
                    {
                        foreach (var route in routes)
                        {
                            contentCol.Item().PaddingTop(10).Column(routeCol =>
                            {
                                // ── Route Header (name centered) ──
                                routeCol.Item().Background(Colors.Grey.Lighten2)
                                    .Padding(6)
                                    .AlignCenter()
                                    .Text($"{route.RouteName}").FontSize(14).Bold();

                                // ── One block per customer stop (numbering stays left, name centered & large) ──
                                // ShowEntire() keeps a stop's header + product table + remarks together as one
                                // unit — if it doesn't fully fit on the current page, the whole block moves to
                                // the next page instead of splitting a customer's products across pages.
                                foreach (var stop in route.Stops)
                                {
                                    routeCol.Item().PaddingTop(8).ShowEntire().Column(stopCol =>
                                    {
                                        stopCol.Item().Background(Colors.Grey.Lighten3)
                                            .Padding(4)
                                            .Row(r =>
                                            {
                                                r.ConstantItem(30).AlignLeft().Text($"{stop.SequenceOrder}.").FontSize(12).Bold();
                                                r.RelativeItem().AlignCenter().Text(stop.CustomerName).FontSize(16).Bold();
                                                r.ConstantItem(30);
                                            });

                                        // Replace the table definition section (around line 260-280) with:

                                        if (stop.Items.Count > 0)
                                        {
                                            // Narrower, centered table: capping the width closes the visual gap
                                            // between PRODUCT and QTY and pushes the leftover space out to equal
                                            // left/right margins instead of sitting between the two columns.
                                            stopCol.Item().AlignCenter().Width(380).PaddingTop(4).Table(table =>
                                            {
                                                table.ColumnsDefinition(columns =>
                                                {
                                                    columns.RelativeColumn(3);  // Product ≈ 75%
                                                    columns.RelativeColumn(1);  // Qty ≈ 25%
                                                });

                                                table.Header(header =>
                                                {
                                                    header.Cell().BorderBottom(1)
                                                        .PaddingVertical(4)
                                                        .PaddingLeft(5)
                                                        .Text("PRODUCT")
                                                        .Bold()
                                                        .FontSize(11);

                                                    header.Cell().BorderBottom(1)
                                                        .PaddingVertical(4)
                                                        .PaddingRight(5)
                                                        .AlignRight()
                                                        .Text("QTY")
                                                        .Bold()
                                                        .FontSize(11);
                                                });

                                                foreach (var item in stop.Items)
                                                {
                                                    // Product name - left aligned, bold, larger
                                                    table.Cell().BorderBottom(0.5f)
                                                        .PaddingVertical(3)
                                                        .PaddingLeft(5)
                                                        .Text($"{item.ProductName}{(string.IsNullOrEmpty(item.SizeGroupName) ? "" : $" ({item.SizeGroupName})")}")
                                                        .FontSize(13)
                                                        .Bold();

                                                    // Quantity right aligned, bold, larger
                                                    table.Cell().BorderBottom(0.5f)
                                                        .PaddingVertical(3)
                                                        .PaddingRight(5)
                                                        .AlignRight()
                                                        .Text($"{item.TotalQuantity:N0} {item.UnitSymbol}")
                                                        .FontSize(13)
                                                        .Bold();
                                                }
                                            });
                                        }
                                        else if (stop.Remarks == null)
                                        {
                                            stopCol.Item().AlignCenter().Width(380).PaddingLeft(5).Padding(3).Text("—").FontSize(10);
                                        }

                                        // ── Retail items / remarks — plain black text, no background shade, no "RETAIL / WEIGH" label ──
                                        // Wrapped with the same AlignCenter().Width(380) + PaddingLeft(5) as the
                                        // product table above, so remarks line up directly under the PRODUCT column
                                        // instead of sitting further left than the table.
                                        if (stop.Remarks != null)
                                        {
                                            // Font size bumped 10 → 13 (matches product/qty row size) so remarks
                                            // are as readable as the rest of the stop block.
                                            stopCol.Item().AlignCenter().Width(380).PaddingLeft(5).PaddingTop(4)
                                                .Text(stop.Remarks).FontSize(13).Bold().FontColor(Colors.Black);
                                        }
                                    });

                                    // ── 50kg bag threshold alert(s), inserted right after the stop that crossed them ──
                                    // Repeats every time cumulative bags cross another multiple (110, 220, 330...).
                                    foreach (var milestone in stop.FiftyKgThresholdMilestonesCrossed)
                                    {
                                        routeCol.Item().PaddingTop(6)
                                            .Background(Colors.Red.Lighten3).Padding(6)
                                            .Text($"⚠ ALERT: 50 KG BAGS HAVE REACHED {milestone}+ (RUNNING TOTAL: {stop.RunningFiftyKgBagTotal}) — AFTER \"{stop.CustomerName}\" — VERIFY LOADING CAPACITY")
                                            .Bold().FontSize(11).FontColor(Colors.Red.Darken2);
                                    }
                                }

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