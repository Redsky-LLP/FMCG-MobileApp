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
                .Include(o => o.Customer)
                .Include(o => o.Route)
                .Include(o => o.Items!)
                    .ThenInclude(i => i.Product)
                .Include(o => o.Items!)
                    .ThenInclude(i => i.Unit)
                .Where(o => !o.IsDeleted
                    && o.Status == OrderStatus.Closed
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
                        var unitTypeLabel = GetUnitTypeLabel(unitName);

                        if (!itemSummaryDict.TryGetValue(key, out var existingSummary))
                        {
                            existingSummary = new LoadingSheetItemSummaryDto
                            {
                                ProductName = item.Product.NameEnglish,
                                ProductNameMalayalam = item.Product.NameMalayalam,
                                UnitSymbol = item.Unit?.Symbol ?? string.Empty,
                                UnitTypeLabel = unitTypeLabel,
                                LoadingPriority = units.GetValueOrDefault(item.UnitId, 99),
                                TotalQuantity = 0,
                                TotalBags = 0,
                                TotalBoxes = 0,
                                TotalTins = 0
                            };
                            itemSummaryDict[key] = existingSummary;
                        }

                        existingSummary.TotalQuantity += item.Quantity;
                        existingSummary.TotalBags += item.QuantityBags ?? 0;
                        existingSummary.TotalBoxes += item.QuantityBoxes ?? 0;
                        existingSummary.TotalTins += item.QuantityTins ?? 0;
                    }
                }

                // ── Build customer stops ──
                var stops = new List<LoadingSheetStopDto>();
                var routeTotalQty = 0m;
                var totalBags = 0;
                var totalBoxes = 0;
                var totalTins = 0;

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
                            UnitName = i.Unit?.Name ?? string.Empty,
                        })
                        .Select(g => new LoadingSheetItemDto
                        {
                            ProductName = g.Key.ProductName,
                            ProductNameMalayalam = g.Key.ProductNameMl,
                            UnitSymbol = g.Key.UnitSymbol,
                            TotalQuantity = g.Sum(i => i.Quantity),
                            LoadingPriority = units.GetValueOrDefault(g.Key.UnitId, 99),
                            UnitTypeLabel = GetUnitTypeLabel(g.Key.UnitName),
                            QuantityBags = g.Sum(i => i.QuantityBags ?? 0),
                            QuantityBoxes = g.Sum(i => i.QuantityBoxes ?? 0),
                            QuantityTins = g.Sum(i => i.QuantityTins ?? 0),
                        })
                        .OrderBy(i => i.LoadingPriority)
                        .ThenBy(i => i.ProductName)
                        .ToList();

                    var stopTotal = groupedItems.Sum(i => i.TotalQuantity);
                    routeTotalQty += stopTotal;
                    totalBags += groupedItems.Sum(i => i.QuantityBags ?? 0);
                    totalBoxes += groupedItems.Sum(i => i.QuantityBoxes ?? 0);
                    totalTins += groupedItems.Sum(i => i.QuantityTins ?? 0);

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
                    TotalBags = totalBags,
                    TotalBoxes = totalBoxes,
                    TotalTins = totalTins,
                    ItemSummary = itemSummaryDict.Values
                        .OrderBy(i => i.LoadingPriority)
                        .ThenBy(i => i.ProductName)
                        .ToList(),
                    Stops = stops
                });
            }

            var data = new LoadingSheetEnhancedDataDto
            {
                ReportDate = targetDate,
                GeneratedAt = DateTime.UtcNow,
                Routes = routeSummaries,
                GrandTotalQuantity = routeSummaries.Sum(r => r.GrandTotalQuantity),
                TotalRoutes = routeSummaries.Count,
                TotalOrders = routeSummaries.Sum(r => r.TotalOrders),
                TotalStops = routeSummaries.Sum(r => r.TotalCustomers),
                GrandTotalBags = routeSummaries.Sum(r => r.TotalBags),
                GrandTotalBoxes = routeSummaries.Sum(r => r.TotalBoxes),
                GrandTotalTins = routeSummaries.Sum(r => r.TotalTins),
                LoadingNote = "🔴 IMPORTANT: Each route has its own section."
            };

            var pdfBytes = GenerateConsolidatedLoadingSheetPdf(data);
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

    private static byte[] GenerateConsolidatedLoadingSheetPdf(LoadingSheetEnhancedDataDto data)
    {
        try
        {
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
                                col.Item().Text($"Date: {data.ReportDate:dd-MM-yyyy}");
                            });
                            row.RelativeItem().AlignRight().Column(col =>
                            {
                                col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                                col.Item().Text($"Routes: {data.TotalRoutes} | Orders: {data.TotalOrders} | Stops: {data.TotalStops}");
                            });
                        });

                    // ── Summary Bar ──
                    page.Header()
                        .PaddingTop(5)
                        .Background(Colors.Orange.Lighten4)
                        .Padding(5)
                        .Row(row =>
                        {
                            row.ConstantItem(24).Text("📦").FontSize(12);
                            row.RelativeItem().Text(
                                $"Total Qty: {data.GrandTotalQuantity:N0} | " +
                                $"BAGS: {data.GrandTotalBags} | " +
                                $"BOXES: {data.GrandTotalBoxes} | " +
                                $"TINS: {data.GrandTotalTins}"
                            ).FontSize(9).Bold();
                        });

                    // ── Table of Contents ──
                    page.Content().Column(col =>
                    {
                        col.Item().PaddingTop(8).PaddingBottom(8).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(2);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).Text("ROUTE").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("ORDERS").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("STOPS").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("BAGS").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("BOXES").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("TINS").Bold();
                            });

                            foreach (var route in data.Routes)
                            {
                                table.Cell().BorderBottom(0.5f).Padding(4).Text(route.RouteName);
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalOrders}");
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalCustomers}");
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalBags}");
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalBoxes}");
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalTins}");
                            }

                            table.Cell().BorderTop(0.5f).Padding(4).Text("GRAND TOTAL").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.TotalOrders}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.TotalStops}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.GrandTotalBags}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.GrandTotalBoxes}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.GrandTotalTins}").Bold();
                        });

                        // ── Each route ──
                        foreach (var route in data.Routes)
                        {
                            // FIX: PageBreak() returns void, so we call it separately
                            col.Item().PageBreak();

                            col.Item().Column(routeCol =>
                            {
                                // Route Header
                                routeCol.Item().Background(Colors.Grey.Lighten2)
                                    .Padding(6)
                                    .Row(r =>
                                    {
                                        r.RelativeItem().Column(c =>
                                        {
                                            c.Item().Text($"{route.RouteName}").FontSize(12).Bold();
                                            c.Item().Text($"Orders: {route.TotalOrders} | Customers: {route.TotalCustomers} | Total Qty: {route.GrandTotalQuantity:N0}");
                                        });
                                        r.RelativeItem().AlignRight().Column(c =>
                                        {
                                            c.Item().Text($"BAGS: {route.TotalBags}  BOXES: {route.TotalBoxes}  TINS: {route.TotalTins}").FontSize(9).Bold();
                                        });
                                    });

                                // Item Summary
                                routeCol.Item().PaddingTop(6)
                                    .Background(Colors.Grey.Lighten3)
                                    .Padding(4)
                                    .Column(summaryCol =>
                                    {
                                        summaryCol.Item().Text("📦 ITEM SUMMARY - TOTAL FOR ROUTE").FontSize(9).Bold();

                                        summaryCol.Item().PaddingTop(4).Table(table =>
                                        {
                                            table.ColumnsDefinition(columns =>
                                            {
                                                columns.RelativeColumn(3);
                                                columns.RelativeColumn(1);
                                                columns.RelativeColumn(1);
                                                columns.RelativeColumn(1);
                                                columns.RelativeColumn(1);
                                                columns.RelativeColumn(1);
                                            });

                                            table.Header(header =>
                                            {
                                                header.Cell().BorderBottom(0.5f).Padding(3).Text("PRODUCT").Bold();
                                                header.Cell().BorderBottom(0.5f).Padding(3).Text("UNIT").Bold();
                                                header.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text("BAGS").Bold();
                                                header.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text("BOXES").Bold();
                                                header.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text("TINS").Bold();
                                                header.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text("TOTAL").Bold();
                                            });

                                            string? currentUnitType = null;
                                            foreach (var item in route.ItemSummary)
                                            {
                                                if (currentUnitType != item.UnitTypeLabel)
                                                {
                                                    currentUnitType = item.UnitTypeLabel;
                                                    table.Cell().ColumnSpan(6)
                                                        .Background(Colors.Grey.Lighten2)
                                                        .Padding(2)
                                                        .Text($"─── {item.UnitTypeLabel} ───").Bold().FontSize(8);
                                                }

                                                table.Cell().BorderBottom(0.5f).Padding(3).Text(item.ProductName);
                                                table.Cell().BorderBottom(0.5f).Padding(3).Text(item.UnitSymbol);
                                                table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text(item.TotalBags > 0 ? item.TotalBags.ToString() : "-");
                                                table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text(item.TotalBoxes > 0 ? item.TotalBoxes.ToString() : "-");
                                                table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text(item.TotalTins > 0 ? item.TotalTins.ToString() : "-");
                                                table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{item.TotalQuantity:N0}");
                                            }

                                            table.Cell().ColumnSpan(2).PaddingTop(4).AlignRight().Text("ROUTE TOTAL:").Bold();
                                            table.Cell().PaddingTop(4).AlignRight().Text($"{route.TotalBags}").Bold();
                                            table.Cell().PaddingTop(4).AlignRight().Text($"{route.TotalBoxes}").Bold();
                                            table.Cell().PaddingTop(4).AlignRight().Text($"{route.TotalTins}").Bold();
                                            table.Cell().PaddingTop(4).AlignRight().Text($"{route.GrandTotalQuantity:N0}").Bold();
                                        });
                                    });

                                // Customer Breakdown
                                routeCol.Item().PaddingTop(8)
                                    .Column(detailCol =>
                                    {
                                        detailCol.Item().Text("👤 CUSTOMER-WISE BREAKDOWN").FontSize(9).Bold();
                                        detailCol.Item().PaddingTop(4).Table(table =>
                                        {
                                            table.ColumnsDefinition(columns =>
                                            {
                                                columns.RelativeColumn(1);
                                                columns.RelativeColumn(2);
                                                columns.RelativeColumn(3);
                                                columns.RelativeColumn(1);
                                            });

                                            table.Header(header =>
                                            {
                                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("#").Bold();
                                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("CUSTOMER").Bold();
                                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("ITEMS").Bold();
                                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("QTY").Bold();
                                            });

                                            foreach (var stop in route.Stops)
                                            {
                                                var itemNames = string.Join(", ", stop.Items.Select(i =>
                                                    $"{i.ProductName} ({i.TotalQuantity:N0} {i.UnitSymbol})"
                                                ));

                                                table.Cell().BorderBottom(0.5f).Padding(3).Text($"#{stop.SequenceOrder}");
                                                table.Cell().BorderBottom(0.5f).Padding(3).Text(stop.CustomerName);
                                                table.Cell().BorderBottom(0.5f).Padding(3).Text(itemNames).FontSize(7);
                                                table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{stop.StopTotalQuantity:N0}");
                                            }
                                        });
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
                            x.Span($"  |  Generated: {data.GeneratedAt:HH:mm:ss}");
                        });
                });
            }).GeneratePdf();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LoadingSheetAll-PDF] Error: {ex.Message}");
            return GenerateEmptyLoadingSheet(data.ReportDate, $"PDF error: {ex.Message}");
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