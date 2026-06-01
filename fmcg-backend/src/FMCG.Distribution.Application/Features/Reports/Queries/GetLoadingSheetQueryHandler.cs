// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetLoadingSheetQueryHandler.cs
// FIXED: Null reference exceptions and better error handling

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Reports.DTOs;
using FMCG.Distribution.Domain.Entities;
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
    public async Task<Result<byte[]>> Handle(GetLoadingSheetQuery request, CancellationToken cancellationToken)
    {
        var targetDate = request.Date ?? DateTime.UtcNow.Date;

        // Get route executions for the target date
        var allowedStatuses = new[] { ExecutionStatus.InProgress, ExecutionStatus.Completed };

        IQueryable<RouteExecution> executionsQuery = context.RouteExecutions
            .Include(e => e.Route)
            .Include(e => e.Visits!)
                .ThenInclude(v => v.Customer)
            .Where(e => e.ExecutionDate.Date == targetDate.Date && allowedStatuses.Contains(e.Status));

        if (request.RouteId.HasValue)
        {
            executionsQuery = executionsQuery.Where(e => e.RouteId == request.RouteId.Value);
        }

        var executions = await executionsQuery.ToListAsync(cancellationToken);

        // If no RouteExecution found, fall back to Orders table
        if (executions.Count == 0)
        {
            return await GenerateFromOrdersDirectAsync(request, targetDate, cancellationToken);
        }

        // Get all visit IDs with orders
        var allVisits = executions.SelectMany(e => e.Visits ?? new List<CustomerVisit>()).ToList();
        var visitIdsWithOrders = allVisits
            .Where(v => v.Status == VisitStatus.OrderPlaced && v.OrderId.HasValue)
            .Select(v => v.OrderId!.Value)
            .ToList();

        if (visitIdsWithOrders.Count == 0)
        {
            var emptyPdf = GenerateEmptyLoadingSheet(targetDate, "No orders have been placed for this route yet.");
            return Result<byte[]>.Success(emptyPdf);
        }

        // Get all orders with their items
        var orders = await context.Orders
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Unit)
            .Include(o => o.Customer)
            .Where(o => visitIdsWithOrders.Contains(o.Id) && !o.IsDeleted)
            .ToListAsync(cancellationToken);

        if (orders.Count == 0)
        {
            var emptyPdf = GenerateEmptyLoadingSheet(targetDate, "Orders found but no items. Please check order details.");
            return Result<byte[]>.Success(emptyPdf);
        }

        // Get unit priorities for sorting
        var units = await context.ProductUnits
            .Where(u => !u.IsDeleted)
            .ToDictionaryAsync(u => u.Id, u => u.LoadingPriority, cancellationToken);

        // Build data for each route
        var routeGroups = new List<LoadingSheetRouteGroupDto>();

        foreach (var execution in executions.OrderBy(e => e.Route?.SequenceOrder ?? 0))
        {
            if (execution.Route == null) continue;

            var routeOrders = orders.Where(o => o.RouteId == execution.RouteId).ToList();
            var visits = execution.Visits?.OrderBy(v => v.SequenceOrder).ToList() ?? new List<CustomerVisit>();

            // Reverse the sequence for LOADING order
            var loadingSequence = visits.OrderByDescending(v => v.SequenceOrder).ToList();

            var stops = new List<LoadingSheetStopDto>();
            decimal routeTotalQuantity = 0;
            int loadingPos = 1;
            int stopsCount = visits.Count;

            foreach (var visit in loadingSequence)
            {
                var order = routeOrders.FirstOrDefault(o => o.CustomerId == visit.CustomerId);
                var isFirstDelivery = visit.SequenceOrder == 1;
                var isLastDelivery = visit.SequenceOrder == stopsCount;

                var stop = new LoadingSheetStopDto
                {
                    CustomerId = visit.CustomerId,
                    CustomerName = visit.Customer?.NameEnglish ?? string.Empty,
                    CustomerNameMalayalam = visit.Customer?.NameMalayalam,
                    SequenceOrder = visit.SequenceOrder,
                    LoadingPosition = loadingPos++,
                    IsFirstDelivery = isFirstDelivery,
                    IsLastDelivery = isLastDelivery,
                    VisitStatus = visit.Status,
                    Items = new List<LoadingSheetItemDto>(),
                    StopTotalQuantity = 0
                };

                if (visit.Status == VisitStatus.OrderPlaced && order != null && order.Items != null)
                {
                    var groupedItems = order.Items
                        .Where(i => i.Product != null)
                        .GroupBy(i => new {
                            i.ProductId,
                            ProductName = i.Product?.NameEnglish ?? string.Empty,
                            ProductNameMl = i.Product?.NameMalayalam,
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
                            QuantityTins = g.Sum(i => i.QuantityTins ?? 0)
                        })
                        .OrderBy(i => i.LoadingPriority)
                        .ThenBy(i => i.ProductName)
                        .ToList();

                    stop.Items = groupedItems;
                    stop.StopTotalQuantity = groupedItems.Sum(i => i.TotalQuantity);
                    routeTotalQuantity += stop.StopTotalQuantity;
                }
                else if (visit.Status == VisitStatus.Skipped)
                {
                    stop.Items.Add(new LoadingSheetItemDto
                    {
                        ProductName = "⏭️ SKIPPED",
                        ProductNameMalayalam = visit.SkipReason,
                        UnitSymbol = "",
                        TotalQuantity = 0
                    });
                }
                else if (visit.Status == VisitStatus.NoOrder)
                {
                    stop.Items.Add(new LoadingSheetItemDto
                    {
                        ProductName = "📋 NO ORDER",
                        ProductNameMalayalam = "No products ordered",
                        UnitSymbol = "",
                        TotalQuantity = 0
                    });
                }

                stops.Add(stop);
            }

            routeGroups.Add(new LoadingSheetRouteGroupDto
            {
                RouteId = execution.RouteId,
                RouteName = execution.Route?.Name ?? string.Empty,
                Stops = stops,
                RouteTotalQuantity = routeTotalQuantity,
                TotalStops = stops.Count,
                TotalOrders = routeOrders.Count
            });
        }

        var totalOrders = routeGroups.Sum(r => r.TotalOrders);
        var totalStops = routeGroups.Sum(r => r.TotalStops);
        var grandTotalQuantity = routeGroups.Sum(r => r.RouteTotalQuantity);

        var data = new LoadingSheetDataDto
        {
            ReportDate = targetDate,
            GeneratedAt = DateTime.UtcNow,
            Routes = routeGroups,
            GrandTotalQuantity = grandTotalQuantity,
            TotalRoutes = routeGroups.Count,
            TotalOrders = totalOrders,
            TotalStops = totalStops,
            LoadingNote = "🔴 IMPORTANT: Load in the order shown below (LOAD #1 = goes in LAST, will be delivered LAST). " +
                         "Items are grouped by unit type - load all bags together, then boxes, then tins."
        };

        var pdfBytes = GenerateLoadingSheetPdf(data);
        return Result<byte[]>.Success(pdfBytes);
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

    // ── Fallback: build sheet directly from Orders table ──────────────────────
    private async Task<Result<byte[]>> GenerateFromOrdersDirectAsync(
        GetLoadingSheetQuery request,
        DateTime targetDate,
        CancellationToken cancellationToken)
    {
        var loadableStatuses = new[] { OrderStatus.Approved, OrderStatus.Packed, OrderStatus.Closed };

        var ordersQuery = context.Orders
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Unit)
            .Include(o => o.Customer)
            .Include(o => o.Route)
            .Where(o => !o.IsDeleted
                && loadableStatuses.Contains(o.Status)
                && o.OrderDate.Date == targetDate);

        if (request.RouteId.HasValue)
            ordersQuery = ordersQuery.Where(o => o.RouteId == request.RouteId.Value);

        var orders = await ordersQuery.ToListAsync(cancellationToken);

        if (orders.Count == 0)
        {
            var emptyPdf = GenerateEmptyLoadingSheet(targetDate,
                $"No approved, packed or closed orders found for date {targetDate:yyyy-MM-dd}. Orders must be Approved by Admin before they appear on the loading sheet.");
            return Result<byte[]>.Success(emptyPdf);
        }

        var units = await context.ProductUnits
            .Where(u => !u.IsDeleted)
            .ToDictionaryAsync(u => u.Id, u => u.LoadingPriority, cancellationToken);

        var routeGroups = new List<LoadingSheetRouteGroupDto>();

        var byRoute = orders
            .Where(o => o.Route != null)
            .GroupBy(o => new { o.RouteId, RouteName = o.Route?.Name ?? "Unknown" })
            .OrderBy(g => g.Key.RouteName);

        foreach (var routeGroup in byRoute)
        {
            var routeOrders = routeGroup
                .OrderBy(o => o.Customer?.SequenceOrder ?? 0)
                .ToList();

            var stops = new List<LoadingSheetStopDto>();
            decimal routeTotalQuantity = 0;
            int loadingPos = 1;
            int stopsCount = routeOrders.Count;

            // Reverse for loading
            foreach (var order in routeOrders.AsEnumerable().Reverse())
            {
                var seqOrder = order.Customer?.SequenceOrder ?? (stopsCount - loadingPos + 1);

                var groupedItems = (order.Items ?? new List<OrderItem>())
                    .Where(i => i.Product != null)
                    .GroupBy(i => new
                    {
                        i.ProductId,
                        ProductName = i.Product?.NameEnglish ?? string.Empty,
                        ProductNameMl = i.Product?.NameMalayalam,
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
                        QuantityTins = g.Sum(i => i.QuantityTins ?? 0)
                    })
                    .OrderBy(i => i.LoadingPriority)
                    .ThenBy(i => i.ProductName)
                    .ToList();

                var stopTotal = groupedItems.Sum(i => i.TotalQuantity);
                routeTotalQuantity += stopTotal;

                stops.Add(new LoadingSheetStopDto
                {
                    CustomerId = order.CustomerId,
                    CustomerName = order.Customer?.NameEnglish ?? string.Empty,
                    CustomerNameMalayalam = order.Customer?.NameMalayalam,
                    SequenceOrder = seqOrder,
                    LoadingPosition = loadingPos++,
                    IsFirstDelivery = seqOrder == 1,
                    IsLastDelivery = seqOrder == stopsCount,
                    VisitStatus = VisitStatus.OrderPlaced,
                    Items = groupedItems,
                    StopTotalQuantity = stopTotal
                });
            }

            routeGroups.Add(new LoadingSheetRouteGroupDto
            {
                RouteId = routeGroup.Key.RouteId,
                RouteName = routeGroup.Key.RouteName,
                Stops = stops,
                RouteTotalQuantity = routeTotalQuantity,
                TotalStops = stops.Count,
                TotalOrders = routeOrders.Count
            });
        }

        var data = new LoadingSheetDataDto
        {
            ReportDate = targetDate,
            GeneratedAt = DateTime.UtcNow,
            Routes = routeGroups,
            GrandTotalQuantity = routeGroups.Sum(r => r.RouteTotalQuantity),
            TotalRoutes = routeGroups.Count,
            TotalOrders = routeGroups.Sum(r => r.TotalOrders),
            TotalStops = routeGroups.Sum(r => r.TotalStops),
            LoadingNote = "🔴 IMPORTANT: Load in the order shown (LOAD #1 goes in LAST, delivered LAST). " +
                         "Items are grouped by unit type - load all bags together, then boxes, then tins."
        };

        var pdfBytes = GenerateLoadingSheetPdf(data);
        return Result<byte[]>.Success(pdfBytes);
    }

    private static byte[] GenerateLoadingSheetPdf(LoadingSheetDataDto data)
    {
        // ... (keep your existing PDF generation code here)
        // This method should be unchanged from your original
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0.5f, PdfUnit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(8).FontFamily("Arial"));

                page.Header()
                    .BorderBottom(0.5f)
                    .PaddingBottom(5)
                    .Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().Text("LOADING SHEET").FontSize(14).Bold();
                            col.Item().Text($"Date: {data.ReportDate:dd-MM-yyyy}");
                        });
                        row.RelativeItem().AlignRight().Column(col =>
                        {
                            col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                            col.Item().Text($"Routes: {data.TotalRoutes} | Stops: {data.TotalStops} | Orders: {data.TotalOrders}");
                        });
                    });

                page.Header()
                    .PaddingTop(5)
                    .Background(Colors.Orange.Lighten4)
                    .Padding(5)
                    .Row(row =>
                    {
                        row.ConstantItem(24).Text("🔴").FontSize(12);
                        row.RelativeItem().Text(data.LoadingNote).FontSize(8).FontColor(Colors.Red.Darken2).Bold();
                    });

                page.Content().Column(col =>
                {
                    foreach (var route in data.Routes)
                    {
                        col.Item().PaddingTop(8).Column(routeCol =>
                        {
                            routeCol.Item().Background(Colors.Grey.Lighten2)
                                .Padding(3)
                                .Row(r =>
                                {
                                    r.RelativeItem().Text($"{route.RouteName}").FontSize(10).Bold();
                                    r.RelativeItem().AlignRight().Text($"Total Qty: {route.RouteTotalQuantity:N0} | Stops: {route.TotalStops}").FontSize(8);
                                });

                            routeCol.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn(1);
                                    columns.RelativeColumn(1);
                                    columns.RelativeColumn(3);
                                    columns.RelativeColumn(2);
                                    columns.RelativeColumn(3);
                                    columns.RelativeColumn(1);
                                    columns.RelativeColumn(1);
                                });

                                table.Header(header =>
                                {
                                    header.Cell().BorderBottom(0.5f).Padding(3).Text("LOAD #").Bold();
                                    header.Cell().BorderBottom(0.5f).Padding(3).Text("DEL #").Bold();
                                    header.Cell().BorderBottom(0.5f).Padding(3).Text("CUSTOMER").Bold();
                                    header.Cell().BorderBottom(0.5f).Padding(3).Text("TYPE").Bold();
                                    header.Cell().BorderBottom(0.5f).Padding(3).Text("PRODUCT").Bold();
                                    header.Cell().BorderBottom(0.5f).Padding(3).Text("UNIT").Bold();
                                    header.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text("QTY").Bold();
                                });

                                foreach (var stop in route.Stops)
                                {
                                    var isFirstRow = true;
                                    var stopColor = stop.VisitStatus == VisitStatus.OrderPlaced
                                        ? (stop.IsFirstDelivery ? Colors.Green.Lighten3 : Colors.White)
                                        : (stop.VisitStatus == VisitStatus.Skipped ? Colors.Red.Lighten4 : Colors.Grey.Lighten3);

                                    if (stop.Items.Count == 0)
                                    {
                                        table.Cell().Background(stopColor).Padding(3).Text(stop.LoadingPosition.ToString());
                                        table.Cell().Background(stopColor).Padding(3).Text(stop.SequenceOrder.ToString());
                                        table.Cell().Background(stopColor).Padding(3).Text(stop.CustomerName);
                                        table.Cell().Background(stopColor).Padding(3).Text("—");
                                        table.Cell().Background(stopColor).Padding(3).Text("—");
                                        table.Cell().Background(stopColor).Padding(3).Text("");
                                        table.Cell().Background(stopColor).Padding(3).AlignRight().Text("-");
                                    }
                                    else
                                    {
                                        string? currentUnitType = null;

                                        foreach (var item in stop.Items)
                                        {
                                            if (currentUnitType != item.UnitTypeLabel)
                                            {
                                                currentUnitType = item.UnitTypeLabel;

                                                table.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text(isFirstRow ? stop.LoadingPosition.ToString() : "");
                                                table.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text(isFirstRow ? stop.SequenceOrder.ToString() : "");
                                                table.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text(isFirstRow ? stop.CustomerName : "");
                                                table.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text($"─── {item.UnitTypeLabel} ───").Bold();
                                                table.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text("");
                                                table.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text("");
                                                table.Cell().Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text("");

                                                isFirstRow = false;
                                            }

                                            var qtyDisplay = "";
                                            if (item.QuantityBags.HasValue && item.QuantityBags.Value > 0)
                                                qtyDisplay += $"{item.QuantityBags} bag(s) ";
                                            if (item.QuantityBoxes.HasValue && item.QuantityBoxes.Value > 0)
                                                qtyDisplay += $"{item.QuantityBoxes} box(es) ";
                                            if (item.QuantityTins.HasValue && item.QuantityTins.Value > 0)
                                                qtyDisplay += $"{item.QuantityTins} tin(s) ";
                                            if (string.IsNullOrWhiteSpace(qtyDisplay))
                                                qtyDisplay = $"{item.TotalQuantity:N0}";

                                            table.Cell().Background(stopColor).Padding(3).Text("");
                                            table.Cell().Background(stopColor).Padding(3).Text("");
                                            table.Cell().Background(stopColor).Padding(3).Text("");
                                            table.Cell().Background(stopColor).Padding(3).Text("");
                                            table.Cell().Background(stopColor).Padding(3).Text(item.ProductName);
                                            table.Cell().Background(stopColor).Padding(3).Text(item.UnitSymbol);
                                            table.Cell().Background(stopColor).Padding(3).AlignRight().Text(qtyDisplay);
                                        }
                                    }

                                    if (stop.Items.Count > 0 && stop.StopTotalQuantity > 0)
                                    {
                                        table.Cell().ColumnSpan(6).PaddingTop(2).AlignRight().Text("Stop Total:").Bold();
                                        table.Cell().PaddingTop(2).AlignRight().Text($"{stop.StopTotalQuantity:N0}").Bold();
                                    }

                                    if (stop.IsFirstDelivery && stop.VisitStatus == VisitStatus.OrderPlaced)
                                    {
                                        table.Cell().ColumnSpan(7)
                                            .PaddingTop(2)
                                            .Background(Colors.Green.Lighten4)
                                            .Padding(2)
                                            .Text("🔴 FIRST DELIVERY - Load this order LAST (on top)").FontSize(7).FontColor(Colors.Green.Darken2);
                                    }
                                }

                                table.Cell().ColumnSpan(6).PaddingTop(5).AlignRight().Text("ROUTE TOTAL:").FontSize(9).Bold();
                                table.Cell().PaddingTop(5).AlignRight().Text($"{route.RouteTotalQuantity:N0}").FontSize(9).Bold();
                            });
                        });
                    }
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
                        x.Span($"  |  Generated: {data.GeneratedAt:HH:mm:ss}");
                    });
            });
        }).GeneratePdf();
    }

    private static byte[] GenerateEmptyLoadingSheet(DateTime targetDate, string message)
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
                        col.Item().Text("• Route execution not started for today").FontSize(9).FontColor(Colors.Grey.Medium);
                        col.Item().Text("• No orders placed yet").FontSize(9).FontColor(Colors.Grey.Medium);
                        col.Item().Text("• Orders are still in Draft status").FontSize(9).FontColor(Colors.Grey.Medium);
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
}