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

public class GetRouteSummaryReportQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetRouteSummaryReportQuery, Result<byte[]>>
{
    public async Task<Result<byte[]>> Handle(GetRouteSummaryReportQuery request, CancellationToken cancellationToken)
    {
        var fromDate = request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var toDate = request.ToDate ?? DateTime.UtcNow.Date;

        // Query orders within date range (submitted or closed, not draft)
        var ordersQuery = context.Orders
        .Include(o => o.Route)
        .Include(o => o.Items!)
        .Where(o => !o.IsDeleted
            && o.OrderDate.Date >= fromDate.Date
            && o.OrderDate.Date <= toDate.Date);   // Draft/Submitted/Closed all included

        if (request.RouteId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.RouteId == request.RouteId.Value);
        }

        var orders = await ordersQuery.ToListAsync(cancellationToken);

        if (orders.Count == 0)
        {
            return Result<byte[]>.Failure($"No orders found between {fromDate:yyyy-MM-dd} and {toDate:yyyy-MM-dd}.");
        }

        // Group by route
        var routeSummaries = orders
            .GroupBy(o => new { o.RouteId, o.Route!.Name })
            .Select(g => new RouteSummaryItemDto
            {
                RouteId = g.Key.RouteId,
                RouteName = g.Key.Name,
                OrderCount = g.Count(),
                TotalQuantity = g.SelectMany(o => o.Items!).Sum(i => i.Quantity),
                TotalSales = g.SelectMany(o => o.Items!).Sum(i => i.SellingPrice * i.Quantity),
                TotalVariance = g.SelectMany(o => o.Items!).Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity)
            })
            .OrderBy(r => r.RouteName)
            .ToList();

        // Calculate margin percentages
        foreach (var route in routeSummaries)
        {
            if (route.TotalSales > 0)
            {
                route.MarginPercentage = (route.TotalVariance / route.TotalSales) * 100;
            }
        }

        var overallSales = routeSummaries.Sum(r => r.TotalSales);
        var overallVariance = routeSummaries.Sum(r => r.TotalVariance);
        var overallMarginPercentage = overallSales > 0 ? (overallVariance / overallSales) * 100 : 0;

        var data = new RouteSummaryReportDataDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            GeneratedAt = DateTime.UtcNow,
            Routes = routeSummaries,
            OverallSales = overallSales,
            OverallVariance = overallVariance,
            OverallMarginPercentage = overallMarginPercentage,
            TotalOrderCount = orders.Count
        };

        // Generate PDF
        var pdfBytes = GenerateRouteSummaryPdf(data);

        return Result<byte[]>.Success(pdfBytes);
    }

    private static byte[] GenerateRouteSummaryPdf(RouteSummaryReportDataDto data)

    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0.5f, PdfUnit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(8).FontFamily("Arial"));

                // Header
                page.Header()
                    .BorderBottom(0.5f)
                    .PaddingBottom(5)
                    .Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().Text("ROUTE SUMMARY REPORT").FontSize(14).Bold();
                            col.Item().Text($"Period: {data.FromDate:dd-MM-yyyy} to {data.ToDate:dd-MM-yyyy}");
                        });
                        row.RelativeItem().AlignRight().Column(col =>
                        {
                            col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                            col.Item().Text($"Total Orders: {data.TotalOrderCount}");
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
                            c.Item().Text("TOTAL ROUTES").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.Routes.Count}").FontSize(12).Bold();
                        });
                    });

                    // Routes table
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(2);  // Route Name
                            columns.RelativeColumn(1);  // Orders
                            columns.RelativeColumn(1);  // Quantity
                            columns.RelativeColumn(2);  // Sales
                            columns.RelativeColumn(2);  // Variance
                            columns.RelativeColumn(1);  // Margin %
                        });

                        // Table header
                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).Text("ROUTE").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("ORDERS").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("QTY").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("SALES").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("VARIANCE").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("MARGIN %").Bold();
                        });

                        // Table rows
                        foreach (var route in data.Routes)
                        {
                            var marginColor = route.MarginPercentage >= 0 ? Colors.Green.Medium : Colors.Red.Medium;
                            table.Cell().BorderBottom(0.5f).Padding(4).Text(route.RouteName);
                            table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.OrderCount}");
                            table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalQuantity:N0}");
                            table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalSales:N2}");
                            table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalVariance:N2}")
                                .FontColor(route.TotalVariance >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                            table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.MarginPercentage:N2}%")
                                .FontColor(marginColor);
                        }

                        // Total row
                        table.Cell().BorderTop(0.5f).Padding(4).Text("TOTAL").Bold();
                        table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.TotalOrderCount}").Bold();
                        table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.Routes.Sum(r => r.TotalQuantity):N0}").Bold();
                        table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.OverallSales:N2}").Bold();
                        table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.OverallVariance:N2}").Bold()
                            .FontColor(data.OverallVariance >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                        table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.OverallMarginPercentage:N2}%").Bold()
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