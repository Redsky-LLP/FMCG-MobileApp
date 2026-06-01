using MediatR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Reports.DTOs;
using FMCG.Distribution.Domain.Enums;

// Alias to resolve ambiguity between QuestPDF.Unit and MediatR.Unit
using PdfUnit = QuestPDF.Infrastructure.Unit;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetBillingSheetQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetBillingSheetQuery, Result<byte[]>>
{
    public async Task<Result<byte[]>> Handle(GetBillingSheetQuery request, CancellationToken cancellationToken)
    {
        var targetDate = request.Date ?? DateTime.UtcNow.Date;

        // Query orders for the target date (submitted or closed, not draft)
        var ordersQuery = context.Orders
        .Include(o => o.Customer)
        .Include(o => o.Route)
        .Include(o => o.Items!)
            .ThenInclude(i => i.Product)
        .Include(o => o.Items!)
            .ThenInclude(i => i.Unit)
        .Where(o => !o.IsDeleted
            && o.OrderDate.Date == targetDate.Date);   // Draft/Submitted/Closed all included

        if (request.RouteId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.RouteId == request.RouteId.Value);
        }

        var orders = await ordersQuery.ToListAsync(cancellationToken);

        if (orders.Count == 0)
        {
            return Result<byte[]>.Failure($"No orders found for date {targetDate:yyyy-MM-dd}.");
        }

        // Group by route
        var routeGroups = orders
            .GroupBy(o => new { o.RouteId, o.Route!.Name })
            .Select(g => new BillingSheetRouteGroupDto
            {
                RouteId = g.Key.RouteId,
                RouteName = g.Key.Name,
                Orders = g.Select(o => new BillingSheetOrderDto
                {
                    OrderId = o.Id,
                    OrderNumber = o.OrderNumber,
                    CustomerName = o.Customer?.NameEnglish ?? string.Empty,
                    CustomerNameMalayalam = o.Customer?.NameMalayalam,
                    OrderDate = o.OrderDate,
                    Items = o.Items!.Select(i => new BillingSheetItemDto
                    {
                        ProductName = i.Product?.NameEnglish ?? string.Empty,
                        ProductNameMalayalam = i.Product?.NameMalayalam,
                        UnitSymbol = i.Unit?.Symbol ?? string.Empty,
                        Quantity = i.Quantity,
                        SellingPrice = i.SellingPrice,
                        LineTotal = i.SellingPrice * i.Quantity,
                        BasePriceAtTime = i.BasePriceAtTime,
                        Variance = (i.SellingPrice - i.BasePriceAtTime) * i.Quantity
                    }).ToList(),
                    OrderTotal = o.Items!.Sum(i => i.SellingPrice * i.Quantity),
                    OrderVariance = o.Items!.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity)
                }).ToList(),
                RouteTotalSales = g.SelectMany(o => o.Items!).Sum(i => i.SellingPrice * i.Quantity),
                RouteTotalVariance = g.SelectMany(o => o.Items!).Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity)
            })
            .OrderBy(r => r.RouteName)
            .ToList();

        var data = new BillingSheetDataDto
        {
            ReportDate = targetDate,
            GeneratedAt = DateTime.UtcNow,
            Routes = routeGroups,
            GrandTotalSales = routeGroups.Sum(r => r.RouteTotalSales),
            GrandTotalVariance = routeGroups.Sum(r => r.RouteTotalVariance),
            TotalOrders = orders.Count,
            TotalRoutes = routeGroups.Count
        };

        // Generate PDF
        var pdfBytes = GenerateBillingSheetPdf(data);

        return Result<byte[]>.Success(pdfBytes);
    }

    private static byte[] GenerateBillingSheetPdf(BillingSheetDataDto data)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0.5f, PdfUnit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(7).FontFamily("Arial"));

                // Header
                page.Header()
                    .BorderBottom(0.5f)
                    .PaddingBottom(5)
                    .Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().Text("BILLING SHEET").FontSize(14).Bold();
                            col.Item().Text($"Date: {data.ReportDate:dd-MM-yyyy}");
                        });
                        row.RelativeItem().AlignRight().Column(col =>
                        {
                            col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                            col.Item().Text($"Orders: {data.TotalOrders} | Routes: {data.TotalRoutes}");
                        });
                    });

                // Content
                page.Content().Column(col =>
                {
                    foreach (var route in data.Routes)
                    {
                        col.Item().PaddingTop(8).Column(routeCol =>
                        {
                            // Route header
                            routeCol.Item().Background(Colors.Grey.Lighten2)
                                .Padding(3)
                                .Row(r =>
                                {
                                    r.RelativeItem().Text($"{route.RouteName}").FontSize(10).Bold();
                                    r.RelativeItem().AlignRight().Text($"Sales: {route.RouteTotalSales:N2} | Variance: {route.RouteTotalVariance:N2}").FontSize(8);
                                });

                            // Orders within route
                            foreach (var order in route.Orders)
                            {
                                routeCol.Item().PaddingTop(6).Column(orderCol =>
                                {
                                    // Order header
                                    orderCol.Item().Background(Colors.Grey.Lighten3)
                                        .Padding(2)
                                        .Row(r =>
                                        {
                                            r.RelativeItem().Text($"Order: {order.OrderNumber}").FontSize(8).Bold();
                                            r.RelativeItem().Text($"Customer: {order.CustomerName}").FontSize(8);
                                            r.RelativeItem().AlignRight().Text($"Total: {order.OrderTotal:N2}").FontSize(8).Bold();
                                        });

                                    // Items table
                                    orderCol.Item().Table(table =>
                                    {
                                        table.ColumnsDefinition(columns =>
                                        {
                                            columns.RelativeColumn(3);  // Product
                                            columns.RelativeColumn(1);  // Unit
                                            columns.RelativeColumn(1);  // Qty
                                            columns.RelativeColumn(1);  // Price
                                            columns.RelativeColumn(1);  // Total
                                            columns.RelativeColumn(1);  // Variance
                                        });

                                        // Table header
                                        table.Header(header =>
                                        {
                                            header.Cell().BorderBottom(0.5f).Padding(2).Text("PRODUCT").Bold();
                                            header.Cell().BorderBottom(0.5f).Padding(2).Text("UNIT").Bold();
                                            header.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("QTY").Bold();
                                            header.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("PRICE").Bold();
                                            header.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("TOTAL").Bold();
                                            header.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("VAR").Bold();
                                        });

                                        // Table rows
                                        foreach (var item in order.Items)
                                        {
                                            var varianceColor = item.Variance >= 0 ? Colors.Green.Medium : Colors.Red.Medium;
                                            table.Cell().Padding(2).Text(item.ProductName);
                                            table.Cell().Padding(2).Text(item.UnitSymbol);
                                            table.Cell().Padding(2).AlignRight().Text($"{item.Quantity:N0}");
                                            table.Cell().Padding(2).AlignRight().Text($"{item.SellingPrice:N2}");
                                            table.Cell().Padding(2).AlignRight().Text($"{item.LineTotal:N2}");
                                            table.Cell().Padding(2).AlignRight().Text($"{item.Variance:N2}").FontColor(varianceColor);
                                        }

                                        // Order total row
                                        table.Cell().ColumnSpan(4).PaddingTop(3).AlignRight().Text("ORDER TOTAL:").Bold();
                                        table.Cell().PaddingTop(3).AlignRight().Text($"{order.OrderTotal:N2}").Bold();
                                        table.Cell().PaddingTop(3).AlignRight().Text($"{order.OrderVariance:N2}").Bold();
                                    });
                                });
                            }

                            // Route total row
                            routeCol.Item().PaddingTop(5).BorderTop(0.5f).Row(r =>
                            {
                                r.RelativeItem().AlignRight().Text("ROUTE TOTAL:").FontSize(8).Bold();
                                r.RelativeItem().AlignRight().Text($"{route.RouteTotalSales:N2}").FontSize(8).Bold();
                                r.RelativeItem().AlignRight().Text($"{route.RouteTotalVariance:N2}").FontSize(8).Bold();
                            });
                        });
                    }

                    // Grand total footer
                    if (data.Routes.Count > 0)
                    {
                        col.Item().PaddingTop(10).BorderTop(0.5f).Background(Colors.Grey.Lighten2).Padding(3).Row(row =>
                        {
                            row.RelativeItem().Text("GRAND TOTAL").FontSize(10).Bold();
                            row.RelativeItem().AlignRight().Text($"Sales: {data.GrandTotalSales:N2}").FontSize(10).Bold();
                            row.RelativeItem().AlignRight().Text($"Variance: {data.GrandTotalVariance:N2}").FontSize(10).Bold();
                        });
                    }
                });

                // Footer
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