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
                // ── Shops shown in the sequence order the admin assigned to customers ──
                Orders = g
                    .OrderBy(o => o.Customer?.SequenceOrder ?? 0)
                    .Select(o => new BillingSheetOrderDto
                    {
                        OrderId = o.Id,
                        OrderNumber = o.OrderNumber,
                        CustomerName = o.Customer?.NameEnglish ?? string.Empty,
                        CustomerNameMalayalam = o.Customer?.NameMalayalam,
                        OrderDate = o.OrderDate,
                        SequenceOrder = o.Customer?.SequenceOrder ?? 0,
                        Remarks = string.IsNullOrWhiteSpace(o.Remarks) ? null : o.Remarks,
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

    // ── PDF Generator: same table style as the Loading Sheet (#, Customer, Order#, Product, Qty),
    // with a Price column added — no Units, line/route/grand totals, or variance. ──
    private static byte[] GenerateBillingSheetPdf(BillingSheetDataDto data)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0.5f, PdfUnit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Arial"));

                // Header
                page.Header()
                    .BorderBottom(0.5f)
                    .PaddingBottom(5)
                    .Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().Text("BILLING SHEET").FontSize(16).Bold();
                            col.Item().Text($"Date: {data.ReportDate:dd-MM-yyyy}").FontSize(10);
                        });
                        row.RelativeItem().AlignRight().Column(col =>
                        {
                            col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}").FontSize(9);
                            col.Item().Text($"Orders: {data.TotalOrders} | Routes: {data.TotalRoutes}").FontSize(9);
                        });
                    });

                // Content
                page.Content().Column(col =>
                {
                    foreach (var route in data.Routes)
                    {
                        col.Item().PaddingTop(10).Column(routeCol =>
                        {
                            // Route header
                            routeCol.Item().Background(Colors.Grey.Lighten2)
                                .Padding(6)
                                .Row(r =>
                                {
                                    r.RelativeItem().Text($"{route.RouteName}").FontSize(13).Bold();
                                    r.RelativeItem().AlignRight().Text($"Orders: {route.Orders.Count}").FontSize(10);
                                });

                            // ── Customer / Order table (#, Customer, Order#, Product, Qty, Price) ──
                            routeCol.Item().PaddingTop(6).Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.ConstantColumn(28);   // #
                                    columns.RelativeColumn(3);    // Customer
                                    columns.RelativeColumn(2);    // Order #
                                    columns.RelativeColumn(4);    // Product
                                    columns.RelativeColumn(1.2f); // Qty
                                    columns.RelativeColumn(1.4f); // Price
                                });

                                table.Header(header =>
                                {
                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).Text("#").Bold().FontSize(10);
                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).Text("CUSTOMER").Bold().FontSize(10);
                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).Text("ORDER #").Bold().FontSize(10);
                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).Text("PRODUCT").Bold().FontSize(10);
                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).AlignRight().Text("QTY").Bold().FontSize(10);
                                    header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(1).Padding(4).AlignRight().Text("PRICE").Bold().FontSize(10);
                                });

                                var rowNum = 1;
                                foreach (var order in route.Orders)
                                {
                                    var firstRow = true;

                                    if (order.Items.Count == 0 && order.Remarks == null)
                                    {
                                        table.Cell().BorderBottom(0.5f).Padding(4).Text($"{rowNum}").Bold().FontSize(11);
                                        table.Cell().BorderBottom(0.5f).Padding(4).Text(order.CustomerName).Bold().FontSize(11);
                                        table.Cell().BorderBottom(0.5f).Padding(4).Text(order.OrderNumber).FontSize(10);
                                        table.Cell().BorderBottom(0.5f).Padding(4).Text("—").FontSize(10);
                                        table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text("").FontSize(10);
                                        table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text("").FontSize(10);
                                    }

                                    foreach (var item in order.Items)
                                    {
                                        var borderBottom = (item == order.Items.Last() && order.Remarks == null) ? 0.5f : 0f;

                                        table.Cell().Padding(4).BorderBottom(borderBottom).Text(firstRow ? $"{rowNum}" : "").Bold().FontSize(11);
                                        table.Cell().Padding(4).BorderBottom(borderBottom).Text(firstRow ? order.CustomerName : "").Bold().FontSize(11);
                                        table.Cell().Padding(4).BorderBottom(borderBottom).Text(firstRow ? order.OrderNumber : "").FontSize(10);
                                        table.Cell().Padding(4).BorderBottom(borderBottom).Text(item.ProductName).FontSize(10);
                                        table.Cell().Padding(4).BorderBottom(borderBottom).AlignRight().Text($"{item.Quantity:N0} {item.UnitSymbol}").FontSize(10).Bold();
                                        table.Cell().Padding(4).BorderBottom(borderBottom).AlignRight().Text($"{item.SellingPrice:N2}").FontSize(10);

                                        firstRow = false;
                                    }

                                    // ── Retail items / remarks row — highlighted, same treatment as the Loading Sheet ──
                                    if (order.Remarks != null)
                                    {
                                        table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).Text(firstRow ? $"{rowNum}" : "").Bold().FontSize(11);
                                        table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).Text(firstRow ? order.CustomerName : "").Bold().FontSize(11);
                                        table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).Text(firstRow ? order.OrderNumber : "").FontSize(10);
                                        table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).Text($"⚖ RETAIL: {order.Remarks}").FontSize(10).Bold().FontColor(Colors.Orange.Darken2);
                                        table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).AlignRight().Text("").FontSize(10);
                                        table.Cell().Padding(4).BorderBottom(0.5f).Background(Colors.Yellow.Lighten3).AlignRight().Text("").FontSize(10);
                                    }

                                    rowNum++;
                                }
                            });
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