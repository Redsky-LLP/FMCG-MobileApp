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

public class GetProductSummaryReportQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetProductSummaryReportQuery, Result<byte[]>>
{
    public async Task<Result<byte[]>> Handle(GetProductSummaryReportQuery request, CancellationToken cancellationToken)
    {
        var fromDate = request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var toDate = request.ToDate ?? DateTime.UtcNow.Date;

        // Query orders within date range (submitted or closed, not draft)
        var ordersQuery = context.Orders
        .Where(o => !o.IsDeleted
            && o.OrderDate.Date >= fromDate.Date
            && o.OrderDate.Date <= toDate.Date);   // Draft/Submitted/Closed all included

        var orderIds = await ordersQuery.Select(o => o.Id).ToListAsync(cancellationToken);

        // Query order items with product details
        var orderItemsQuery = context.OrderItems
            .Include(i => i.Product!)
                .ThenInclude(p => p!.ProductGroup)
            .Include(i => i.Unit)
            .Where(i => orderIds.Contains(i.OrderId) && !i.IsDeleted);

        if (request.ProductGroupId.HasValue)
        {
            orderItemsQuery = orderItemsQuery.Where(i => i.Product != null && i.Product.ProductGroupId == request.ProductGroupId.Value);
        }

        var orderItems = await orderItemsQuery.ToListAsync(cancellationToken);

        if (orderItems.Count == 0)
        {
            return Result<byte[]>.Failure($"No product sales found between {fromDate:yyyy-MM-dd} and {toDate:yyyy-MM-dd}.");
        }

        // Group by product
        var productSummaries = orderItems
            .GroupBy(i => new { i.ProductId, i.Product!.NameEnglish, i.Product.NameMalayalam, i.Product!.ProductGroup!.Name, i.Unit!.Symbol })
            .Select(g => new ProductSummaryItemDto
            {
                ProductId = g.Key.ProductId,
                ProductName = g.Key.NameEnglish,
                ProductNameMalayalam = g.Key.NameMalayalam,
                ProductGroupName = g.Key.Name,
                UnitSymbol = g.Key.Symbol,
                TotalQuantity = g.Sum(i => i.Quantity),
                TotalSales = g.Sum(i => i.SellingPrice * i.Quantity),
                TotalVariance = g.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity),
                OrderCount = g.Select(i => i.OrderId).Distinct().Count()
            })
            .OrderBy(p => p.ProductName)
            .ToList();

        // Calculate margin percentages
        foreach (var product in productSummaries)
        {
            if (product.TotalSales > 0)
            {
                product.MarginPercentage = (product.TotalVariance / product.TotalSales) * 100;
            }
        }

        var overallSales = productSummaries.Sum(p => p.TotalSales);
        var overallVariance = productSummaries.Sum(p => p.TotalVariance);
        var overallMarginPercentage = overallSales > 0 ? (overallVariance / overallSales) * 100 : 0;

        var data = new ProductSummaryReportDataDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            GeneratedAt = DateTime.UtcNow,
            Products = productSummaries,
            OverallSales = overallSales,
            OverallVariance = overallVariance,
            OverallMarginPercentage = overallMarginPercentage,
            TotalProductCount = productSummaries.Count
        };

        // Generate PDF
        var pdfBytes = GenerateProductSummaryPdf(data);

        return Result<byte[]>.Success(pdfBytes);
    }

    private static byte[] GenerateProductSummaryPdf(ProductSummaryReportDataDto data)

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
                            col.Item().Text("PRODUCT SUMMARY REPORT").FontSize(14).Bold();
                            col.Item().Text($"Period: {data.FromDate:dd-MM-yyyy} to {data.ToDate:dd-MM-yyyy}");
                        });
                        row.RelativeItem().AlignRight().Column(col =>
                        {
                            col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                            col.Item().Text($"Products: {data.TotalProductCount}");
                        });
                    });

                // Content
                page.Content().Column(col =>
                {
                    // Summary statistics
                    col.Item().PaddingTop(8).PaddingBottom(8).Row(summaryRow =>
                    {
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("TOTAL SALES").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.OverallSales:N2}").FontSize(12).Bold();
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("TOTAL VARIANCE").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.OverallVariance:N2}").FontSize(12).Bold()
                                .FontColor(data.OverallVariance >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("MARGIN %").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.OverallMarginPercentage:N2}%").FontSize(12).Bold()
                                .FontColor(data.OverallMarginPercentage >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("PRODUCTS").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.TotalProductCount}").FontSize(12).Bold();
                        });
                    });

                    // Products table
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3);  // Product Name
                            columns.RelativeColumn(1);  // Group
                            columns.RelativeColumn(1);  // Unit
                            columns.RelativeColumn(1);  // Qty
                            columns.RelativeColumn(1);  // Orders
                            columns.RelativeColumn(2);  // Sales
                            columns.RelativeColumn(2);  // Variance
                            columns.RelativeColumn(1);  // Margin %
                        });

                        // Table header
                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("PRODUCT").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("GROUP").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("UNIT").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("QTY").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("ORDERS").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("SALES").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("VARIANCE").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("MARGIN %").Bold();
                        });

                        // Table rows
                        foreach (var product in data.Products)
                        {
                            var marginColor = product.MarginPercentage >= 0 ? Colors.Green.Medium : Colors.Red.Medium;
                            table.Cell().BorderBottom(0.5f).Padding(3).Text(product.ProductName);
                            table.Cell().BorderBottom(0.5f).Padding(3).Text(product.ProductGroupName);
                            table.Cell().BorderBottom(0.5f).Padding(3).Text(product.UnitSymbol);
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{product.TotalQuantity:N0}");
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{product.OrderCount}");
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{product.TotalSales:N2}");
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{product.TotalVariance:N2}")
                                .FontColor(product.TotalVariance >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{product.MarginPercentage:N2}%")
                                .FontColor(marginColor);
                        }

                        // Total row
                        table.Cell().BorderTop(0.5f).Padding(3).Text("TOTAL").Bold();
                        table.Cell().BorderTop(0.5f).Padding(3).Text("").Bold();
                        table.Cell().BorderTop(0.5f).Padding(3).Text("").Bold();
                        table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{data.Products.Sum(p => p.TotalQuantity):N0}").Bold();
                        table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{data.Products.Sum(p => p.OrderCount)}").Bold();
                        table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{data.OverallSales:N2}").Bold();
                        table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{data.OverallVariance:N2}").Bold()
                            .FontColor(data.OverallVariance >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                        table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{data.OverallMarginPercentage:N2}%").Bold()
                            .FontColor(data.OverallMarginPercentage >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                    });
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