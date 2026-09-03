// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetLoadingSheetAllQueryHandler.cs

using System;
using System.Collections.Generic;
using System.Linq;
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

public class GetLoadingSheetAllQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetLoadingSheetAllQuery, Result<byte[]>>
{
    public async Task<Result<byte[]>> Handle(GetLoadingSheetAllQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var targetDate = request.Date?.Date ?? DateTime.UtcNow.Date;

            // ── Get all orders with Closed status for the target date ──
            var closedOrders = await context.Orders
                .AsNoTracking()
                .Include(o => o.Customer)
                .Include(o => o.Route)
                .Include(o => o.Items!)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p!.ProductGroup)
                .Include(o => o.Items!)
                    .ThenInclude(i => i.Product)
                        .ThenInclude(p => p!.SizeGroup)
                .Include(o => o.Items!)
                    .ThenInclude(i => i.Unit)
                .Where(o => !o.IsDeleted
                    && (o.Status == OrderStatus.Closed || o.IsLocked)
                    && o.OrderDate.Date == targetDate.Date)
                .ToListAsync(cancellationToken);

            if (closedOrders.Count == 0)
            {
                var emptyPdf = GenerateEmptyLoadingSheet(
                    targetDate,
                    "No closed orders found for any route."
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
                .AsNoTracking()
                .Where(u => !u.IsDeleted)
                .ToDictionaryAsync(u => u.Id, u => u.LoadingPriority, cancellationToken);

            var routeSummaries = new List<LoadingSheetRouteSummaryDto>();

            foreach (var routeGroup in routeGroups)
            {
                var routeOrders = routeGroup.ToList();

                // ── Build item summary for this route ──
                var itemSummaryDict = new Dictionary<string, LoadingSheetItemSummaryDto>();

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
                    }
                }

                // ── Build customer stops ──
                var stops = new List<LoadingSheetStopDto>();
                var routeTotalQty = 0m;

                var orderedOrders = routeOrders
                    .OrderBy(o => o.Customer?.SequenceOrder ?? 0)
                    .ToList();

                int stopNumber = 1;
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
                            // ── NEW: needed for the X marker on VEGETABLES/CHILLES items ──
                            ProductGroupName = i.Product.ProductGroup != null ? i.Product.ProductGroup.Name : null,
                            // ── NEW: needed for the loading-limit alert's bag-weight detection ──
                            SizeGroupName = i.SizeGroupNameAtTime ?? (i.Product.SizeGroup != null ? i.Product.SizeGroup.Name : null),
                        })
                        .Select(g => new LoadingSheetItemDto
                        {
                            ProductName = g.Key.ProductName,
                            ProductNameMalayalam = g.Key.ProductNameMl,
                            UnitSymbol = g.Key.UnitSymbol,
                            TotalQuantity = g.Sum(i => i.Quantity),
                            LoadingPriority = units.GetValueOrDefault(g.Key.UnitId, 99),
                            UnitTypeLabel = GetUnitTypeLabel(g.Key.UnitSymbol),
                            ProductGroupName = g.Key.ProductGroupName,
                            SizeGroupName = g.Key.SizeGroupName,
                            QuantityBags = 0,
                            QuantityBoxes = 0,
                            QuantityTins = 0,
                        })
                        .OrderBy(i => i.LoadingPriority)
                        .ThenBy(i => i.ProductName)
                        .ToList();

                    var stopTotal = groupedItems.Sum(i => i.TotalQuantity);
                    routeTotalQty += stopTotal;

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
                        StopTotalQuantity = stopTotal
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
                    Stops = stops
                });
            }

            var pdfBytes = GenerateConsolidatedLoadingSheetPdf(routeSummaries, targetDate);
            return Result<byte[]>.Success(pdfBytes);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LoadingSheetAll] Error: {ex.Message}");
            Console.WriteLine($"[LoadingSheetAll] StackTrace: {ex.StackTrace}");

            var errorPdf = GenerateEmptyLoadingSheet(
                request.Date?.Date ?? DateTime.UtcNow.Date,
                $"Error generating loading sheet: {ex.Message}"
            );
            return Result<byte[]>.Success(errorPdf);
        }
    }

    // ── NEW: matches a size-group name against a specific weight, same helper as
    // GetLoadingSheetQueryHandler — used for the loading-limit alert below. ──
    private static bool MatchesSizeGroupWeight(string? sizeGroupName, int kg)
        => sizeGroupName != null && System.Text.RegularExpressions.Regex.IsMatch(sizeGroupName, $@"\b{kg}\s*kg\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    // Same threshold as the main Loading Sheet — kept in sync with GetLoadingSheetQueryHandler.
    // FIX: threshold changed from 130 to 125, per updated request.
    private const int BagLoadingThreshold = 125;

    // ── NEW: flags products in the VEGETABLES and CHILLES item groups so they can be
    // marked with an "X" on the printed sheet — same rule as the other report handlers. ──
    private static readonly HashSet<string> FlaggedProductGroups =
        new(StringComparer.OrdinalIgnoreCase) { "VEGETABLES", "CHILLES" };

    private static bool IsFlaggedProductGroup(string? productGroupName)
        => productGroupName != null && FlaggedProductGroups.Contains(productGroupName.Trim());

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

    // ── Consolidated PDF with Table of Contents ──
    private static byte[] GenerateConsolidatedLoadingSheetPdf(
        List<LoadingSheetRouteSummaryDto> routes,
        DateTime targetDate)
    {
        try
        {
            var totalOrders = routes.Sum(r => r.TotalOrders);
            var totalStops = routes.Sum(r => r.TotalCustomers);
            var totalQty = routes.Sum(r => r.GrandTotalQuantity);

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(0.5f, PdfUnit.Centimetre);
                    page.DefaultTextStyle(x => x.FontSize(8).FontFamily("Arial"));

                    // ── Header ──
                    page.Header()
                        .BorderBottom(0.5f)
                        .PaddingBottom(5)
                        .Row(row =>
                        {
                            row.RelativeItem().Column(col =>
                            {
                                col.Item().Text("LOADING SHEET - ALL ROUTES").FontSize(14).Bold();
                                col.Item().Text($"Date: {targetDate:dd-MM-yyyy}");
                            });
                            row.RelativeItem().AlignRight().Column(col =>
                            {
                                col.Item().Text($"Generated: {DateTime.UtcNow:dd-MM-yyyy HH:mm}");
                                col.Item().Text($"Routes: {routes.Count} | Orders: {totalOrders} | Stops: {totalStops}");
                            });
                        });

                    // ── Content ──
                    page.Content().Column(contentCol =>
                    {
                        // ── Table of Contents ──
                        contentCol.Item().PaddingTop(8).PaddingBottom(8).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(3);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).Text("ROUTE").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("ORDERS").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("CUSTOMERS").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("TOTAL QTY").Bold();
                            });

                            foreach (var route in routes)
                            {
                                table.Cell().BorderBottom(0.5f).Padding(4).Text(route.RouteName);
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalOrders}");
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalCustomers}");
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.GrandTotalQuantity:N0}");
                            }

                            table.Cell().BorderTop(0.5f).Padding(4).Text("GRAND TOTAL").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{totalOrders}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{totalStops}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{totalQty:N0}").Bold();
                        });

                        // ── Each route detail ──
                        foreach (var route in routes)
                        {
                            contentCol.Item().PageBreak();

                            contentCol.Item().Column(routeCol =>
                            {
                                // ── Route Header ──
                                routeCol.Item().Background(Colors.Grey.Lighten2)
                                    .Padding(6)
                                    .Row(r =>
                                    {
                                        r.RelativeItem().Column(c =>
                                        {
                                            c.Item().Text($"{route.RouteName}").FontSize(12).Bold();
                                            c.Item().Text($"Orders: {route.TotalOrders} | Customers: {route.TotalCustomers}");
                                        });
                                        r.RelativeItem().AlignRight().Column(c =>
                                        {
                                            c.Item().Text($"Total Qty: {route.GrandTotalQuantity:N0}").FontSize(11).Bold();
                                        });
                                    });

                                // ── Item Summary ──
                                routeCol.Item().PaddingTop(6)
                                    .Background(Colors.Grey.Lighten3)
                                    .Padding(4)
                                    .Column(summaryCol =>
                                    {
                                        summaryCol.Item().Text("📦 ITEMS").FontSize(9).Bold();

                                        summaryCol.Item().PaddingTop(4).Table(table =>
                                        {
                                            table.ColumnsDefinition(columns =>
                                            {
                                                columns.RelativeColumn(4);
                                                columns.RelativeColumn(2);
                                                columns.RelativeColumn(2);
                                            });

                                            table.Header(header =>
                                            {
                                                header.Cell().BorderBottom(0.5f).Padding(3).Text("PRODUCT").Bold();
                                                header.Cell().BorderBottom(0.5f).Padding(3).Text("UNIT").Bold();
                                                header.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text("QTY").Bold();
                                            });

                                            foreach (var item in route.ItemSummary)
                                            {
                                                table.Cell().BorderBottom(0.5f).Padding(3).Text(item.ProductName);
                                                table.Cell().BorderBottom(0.5f).Padding(3).Text(item.UnitSymbol);
                                                table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{item.TotalQuantity:N0}");
                                            }

                                            table.Cell().BorderTop(0.5f).Padding(3).Text("ROUTE TOTAL").Bold();
                                            table.Cell().BorderTop(0.5f).Padding(3);
                                            table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{route.GrandTotalQuantity:N0}").Bold();
                                        });
                                    });

                                // ── Customer Breakdown ──
                                routeCol.Item().PaddingTop(8)
                                    .Column(detailCol =>
                                    {
                                        detailCol.Item().Text("👤 CUSTOMERS").FontSize(9).Bold();

                                        if (route.Stops.Count == 0)
                                        {
                                            detailCol.Item()
                                                .PaddingTop(6)
                                                .Padding(10)
                                                .AlignCenter()
                                                .Text("No customers with orders for this route.")
                                                .FontSize(9)
                                                .FontColor(Colors.Grey.Medium);
                                        }
                                        else
                                        {
                                            detailCol.Item().PaddingTop(4).Table(table =>
                                            {
                                                table.ColumnsDefinition(columns =>
                                                {
                                                    columns.RelativeColumn(1);
                                                    columns.RelativeColumn(3);
                                                    columns.RelativeColumn(4);
                                                    columns.RelativeColumn(1);
                                                });

                                                table.Header(header =>
                                                {
                                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("#").Bold();
                                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("CUSTOMER").Bold();
                                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("ITEMS").Bold();
                                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("QTY").Bold();
                                                });

                                                // ── NEW: live loading-limit threshold tracking for this route,
                                                // same rule as the main Loading Sheet (130, 260, 390... with
                                                // 50kg bags full weight, 30kg/26kg bags at 0.5 each). This
                                                // table's rows are already one-per-customer (items pre-joined
                                                // into a single comma-separated cell), so the finest point an
                                                // alert can land at is right after the customer row whose
                                                // items caused the crossing — inserted as its own row spanning
                                                // all 4 columns, rather than splitting into a separate table
                                                // like the main handler needs to. ──
                                                // FIX: single running total (cycleWeightedTotal) replaces
                                                // the old never-reset liveWeightedTotal + separately-reset
                                                // breakdown counts. That split let overshoot past 130 in one
                                                // cycle silently vanish from the display counters while still
                                                // counting toward the never-reset detector — causing later
                                                // alerts to under-report (a total under 130 while still
                                                // claiming the limit was crossed). Now everything resets and
                                                // accumulates together, so they can't drift apart.
                                                var cycleWeightedTotal = 0m;
                                                var liveFiftyKg = 0;
                                                var liveThirtyKg = 0;
                                                var liveTwentySixKg = 0;

                                                foreach (var stop in route.Stops)
                                                {
                                                    // FIX: X marker now rendered as its own larger, bolder span
                                                    // per flagged item, instead of a plain "X" character glued
                                                    // into the joined string at the same size/weight as
                                                    // everything else — was reading as too thin. Still inline,
                                                    // still no new column, same cell as before.
                                                    table.Cell().BorderBottom(0.5f).Padding(3).Text($"#{stop.SequenceOrder}");
                                                    table.Cell().BorderBottom(0.5f).Padding(3).Text(stop.CustomerName);
                                                    table.Cell().BorderBottom(0.5f).Padding(3).Text(text =>
                                                    {
                                                        for (var i = 0; i < stop.Items.Count; i++)
                                                        {
                                                            var item = stop.Items[i];
                                                            text.Span($"{item.ProductName} ({item.TotalQuantity:N0} {item.UnitSymbol})").FontSize(7);
                                                            if (IsFlaggedProductGroup(item.ProductGroupName))
                                                            {
                                                                text.Span("  X").FontSize(11).ExtraBold().FontColor(Colors.Black);
                                                            }
                                                            if (i < stop.Items.Count - 1)
                                                            {
                                                                text.Span(", ").FontSize(7);
                                                            }
                                                        }
                                                    });
                                                    table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{stop.StopTotalQuantity:N0}");

                                                    // ── FIX: loading-limit alert restored for this consolidated
                                                    // report too — inserted as its own full-width row right
                                                    // after the customer whose items crossed the threshold. ──
                                                    foreach (var item in stop.Items)
                                                    {
                                                        var weight = MatchesSizeGroupWeight(item.SizeGroupName, 50) ? 1m
                                                            : (MatchesSizeGroupWeight(item.SizeGroupName, 30) || MatchesSizeGroupWeight(item.SizeGroupName, 26)) ? 0.5m
                                                            : 0m;
                                                        var qty = (int)item.TotalQuantity;

                                                        if (MatchesSizeGroupWeight(item.SizeGroupName, 50)) liveFiftyKg += qty;
                                                        else if (MatchesSizeGroupWeight(item.SizeGroupName, 30)) liveThirtyKg += qty;
                                                        else if (MatchesSizeGroupWeight(item.SizeGroupName, 26)) liveTwentySixKg += qty;

                                                        cycleWeightedTotal += weight * qty;
                                                    }

                                                    if (cycleWeightedTotal >= BagLoadingThreshold)
                                                    {
                                                        // FIX: alert message shortened to a single line, per
                                                        // updated request — same fix as the main handler.
                                                        table.Cell().ColumnSpan(4)
                                                            .Background(Colors.Red.Lighten3).Padding(5)
                                                            .Text($"Combined total (26kg + 30kg + 50kg) has reached {cycleWeightedTotal:0.#} bags. Threshold limit is {BagLoadingThreshold}. Do not load more than {BagLoadingThreshold} bags.")
                                                            .Bold().FontSize(8).FontColor(Colors.Red.Darken2);

                                                        // Reset everything together for the next cycle.
                                                        cycleWeightedTotal = 0m;
                                                        liveFiftyKg = 0;
                                                        liveThirtyKg = 0;
                                                        liveTwentySixKg = 0;
                                                    }
                                                }
                                            });
                                        }
                                    });
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
            Console.WriteLine($"[LoadingSheetAll-PDF] Error: {ex.Message}");
            return GenerateEmptyLoadingSheet(targetDate, $"PDF error: {ex.Message}");
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
                    page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Arial"));

                    page.Header()
                        .BorderBottom(0.5f)
                        .PaddingBottom(5)
                        .Row(row =>
                        {
                            row.RelativeItem().Column(col =>
                            {
                                col.Item().Text("LOADING SHEET - ALL ROUTES").FontSize(14).Bold();
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
                            col.Item().Text("• No closed orders found for any route").FontSize(9).FontColor(Colors.Grey.Medium);
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