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
                        })
                        .Select(g => new LoadingSheetItemDto
                        {
                            ProductName = g.Key.ProductName,
                            ProductNameMalayalam = g.Key.ProductNameMl,
                            UnitSymbol = g.Key.UnitSymbol,
                            TotalQuantity = g.Sum(i => i.Quantity),
                            LoadingPriority = units.GetValueOrDefault(g.Key.UnitId, 99),
                            UnitTypeLabel = GetUnitTypeLabel(g.Key.UnitSymbol),
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