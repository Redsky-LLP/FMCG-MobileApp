// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetBillingSheetQueryHandler.cs

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Reports.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
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

    // ── PDF Generator: matching the Loading Sheet style with 3 columns (Product, Qty, Price) ──
    private static byte[] GenerateBillingSheetPdf(BillingSheetDataDto data)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0.5f, PdfUnit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Times New Roman"));

                // Header
                page.Header()
                    .BorderBottom(0.5f)
                    .PaddingBottom(5)
                    .Column(col =>
                    {
                        col.Item().Text("BILLING SHEET").FontSize(16).Bold();
                        col.Item().Text($"Date: {data.ReportDate:dd-MM-yyyy}").FontSize(10);
                    });

                // Content
                page.Content().Column(contentCol =>
                {
                    foreach (var route in data.Routes)
                    {
                        contentCol.Item().PaddingTop(10).Column(routeCol =>
                        {
                            // Route header - centered like loading sheet
                            routeCol.Item().Background(Colors.Grey.Lighten2)
                                .Padding(6)
                                .AlignCenter()
                                .Text($"{route.RouteName}").FontSize(14).Bold();

                            // ── One block per customer stop ──
                            foreach (var order in route.Orders)
                            {
                                routeCol.Item().PaddingTop(8).ShowEntire().Column(stopCol =>
                                {
                                    // Customer header with number and name centered
                                    stopCol.Item().Background(Colors.Grey.Lighten3)
                                        .Padding(4)
                                        .Row(r =>
                                        {
                                            r.ConstantItem(30).AlignLeft().Text($"{order.SequenceOrder + 1}.").FontSize(12).Bold();
                                            r.RelativeItem().AlignCenter().Text(order.CustomerName).FontSize(16).Bold();
                                            r.ConstantItem(30);
                                        });

                                    if (order.Items.Count > 0)
                                    {
                                        stopCol.Item().PaddingLeft(15).PaddingRight(15).PaddingTop(4).Table(table =>
                                        {
                                            // Three columns: Product (40%), Qty (20%), Price (40%)
                                            table.ColumnsDefinition(columns =>
                                            {
                                                columns.RelativeColumn(4);  // Product takes 40%
                                                columns.RelativeColumn(2);  // Qty takes 20%
                                                columns.RelativeColumn(4);  // Price takes 40%
                                            });

                                            table.Header(header =>
                                            {
                                                header.Cell().BorderBottom(1)
                                                    .PaddingVertical(3)
                                                    .PaddingLeft(5)
                                                    .Text("PRODUCT")
                                                    .Bold()
                                                    .FontSize(9);

                                                header.Cell().BorderBottom(1)
                                                    .PaddingVertical(3)
                                                    .AlignCenter()
                                                    .Text("QTY")
                                                    .Bold()
                                                    .FontSize(9);

                                                header.Cell().BorderBottom(1)
                                                    .PaddingVertical(3)
                                                    .PaddingRight(5)
                                                    .AlignRight()
                                                    .Text("PRICE")
                                                    .Bold()
                                                    .FontSize(9);
                                            });

                                            foreach (var item in order.Items)
                                            {
                                                // Product name - left aligned
                                                table.Cell().BorderBottom(0.5f)
                                                    .PaddingVertical(2)
                                                    .PaddingLeft(5)
                                                    .Text(item.ProductName)
                                                    .FontSize(10);

                                                // Quantity - centered
                                                table.Cell().BorderBottom(0.5f)
                                                    .PaddingVertical(2)
                                                    .AlignCenter()
                                                    .Text($"{item.Quantity:N0} {item.UnitSymbol}")
                                                    .FontSize(10)
                                                    .Bold();

                                                // Price - right aligned
                                                table.Cell().BorderBottom(0.5f)
                                                    .PaddingVertical(2)
                                                    .PaddingRight(5)
                                                    .AlignRight()
                                                    .Text($"₹{item.SellingPrice:N2}")
                                                    .FontSize(10);
                                            }
                                        });
                                    }
                                    else if (order.Remarks == null)
                                    {
                                        stopCol.Item().PaddingLeft(20).Padding(3).Text("—").FontSize(10);
                                    }

                                    // ── Remarks - plain black text, no background shade ──
                                    if (order.Remarks != null)
                                    {
                                        stopCol.Item().PaddingLeft(20).PaddingTop(4)
                                            .Text(order.Remarks).FontSize(10).Bold().FontColor(Colors.Black);
                                    }
                                });
                            }

                            if (route != data.Routes.Last())
                            {
                                routeCol.Item().PageBreak();
                            }
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
                        x.Span($"  |  Generated: {data.GeneratedAt:HH:mm:ss}");
                    });
            });
        }).GeneratePdf();
    }
}