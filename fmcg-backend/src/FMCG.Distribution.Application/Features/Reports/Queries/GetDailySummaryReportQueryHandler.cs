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

public class GetDailySummaryReportQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetDailySummaryReportQuery, Result<byte[]>>
{
    public async Task<Result<byte[]>> Handle(GetDailySummaryReportQuery request, CancellationToken cancellationToken)
    {
        var targetDate = request.Date ?? DateTime.UtcNow.Date;

        // Query orders for the target date (submitted or closed, not draft)
        var ordersQuery = context.Orders
            .Include(o => o.Route)
            .Include(o => o.Items!)
            .Where(o => !o.IsDeleted
                && o.Status != OrderStatus.Draft
                && o.OrderDate.Date == targetDate.Date);

        var orders = await ordersQuery.ToListAsync(cancellationToken);

        // Check if day is closed
        var dailyClosure = await context.DailyClosures
            .FirstOrDefaultAsync(c => !c.IsDeleted && c.ClosureDate.Date == targetDate.Date, cancellationToken);

        if (orders.Count == 0 && dailyClosure == null)
        {
            return Result<byte[]>.Failure($"No orders found for date {targetDate:yyyy-MM-dd}.");
        }

        // Group by route
        var routeSummaries = orders
            .GroupBy(o => new { o.RouteId, o.Route!.Name })
            .Select(g => new DailySummaryItemDto
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

        var data = new DailySummaryReportDataDto
        {
            ReportDate = targetDate,
            GeneratedAt = DateTime.UtcNow,
            Routes = routeSummaries,
            TotalSales = routeSummaries.Sum(r => r.TotalSales),
            TotalVariance = routeSummaries.Sum(r => r.TotalVariance),
            TotalOrders = orders.Count,
            TotalRoutes = routeSummaries.Count,
            IsDayClosed = dailyClosure != null,
            ClosedAt = dailyClosure?.ClosedAt
        };

        // Generate PDF
        var pdfBytes = GenerateDailySummaryPdf(data);

        return Result<byte[]>.Success(pdfBytes);
    }

    private byte[] GenerateDailySummaryPdf(DailySummaryReportDataDto data)
    {
        var totalMarginPercentage = data.TotalSales > 0 ? (data.TotalVariance / data.TotalSales) * 100 : 0;

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
                            col.Item().Text("DAILY SUMMARY REPORT").FontSize(14).Bold();
                            col.Item().Text($"Date: {data.ReportDate:dd-MM-yyyy}");
                        });
                        row.RelativeItem().AlignRight().Column(col =>
                        {
                            col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                            col.Item().Text($"Status: {(data.IsDayClosed ? "CLOSED" : "OPEN")}")
                                .FontColor(data.IsDayClosed ? Colors.Green.Medium : Colors.Orange.Medium)
                                .Bold();
                        });
                    });

                // Content
                page.Content().Column(col =>
                {
                    // Closure info if day is closed
                    if (data.IsDayClosed && data.ClosedAt.HasValue)
                    {
                        col.Item().Background(Colors.Green.Lighten3)
                            .Padding(5)
                            .Row(r =>
                            {
                                r.RelativeItem().Text("✓ DAY CLOSED").FontSize(9).Bold().FontColor(Colors.Green.Darken2);
                                r.RelativeItem().AlignRight().Text($"Closed at: {data.ClosedAt.Value:dd-MM-yyyy HH:mm}")
                                    .FontSize(8).FontColor(Colors.Green.Darken2);
                            });
                    }

                    // Summary statistics
                    col.Item().PaddingTop(8).PaddingBottom(8).Row(summaryRow =>
                    {
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("TOTAL SALES").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.TotalSales:N2}").FontSize(12).Bold();
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("TOTAL VARIANCE").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.TotalVariance:N2}").FontSize(12).Bold()
                                .FontColor(data.TotalVariance >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("MARGIN %").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{totalMarginPercentage:N2}%").FontSize(12).Bold()
                                .FontColor(totalMarginPercentage >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("ORDERS / ROUTES").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.TotalOrders} / {data.TotalRoutes}").FontSize(12).Bold();
                        });
                    });

                    // Routes table
                    if (data.Routes.Count > 0)
                    {
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(2);  // Route Name
                                columns.RelativeColumn(1);  // Orders
                                columns.RelativeColumn(1);  // Quantity
                                columns.RelativeColumn(2);  // Sales
                                columns.RelativeColumn(2);  // Variance
                            });

                            // Table header
                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).Text("ROUTE").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("ORDERS").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("QTY").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("SALES").Bold();
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(4).AlignRight().Text("VARIANCE").Bold();
                            });

                            // Table rows
                            foreach (var route in data.Routes)
                            {
                                table.Cell().BorderBottom(0.5f).Padding(4).Text(route.RouteName);
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.OrderCount}");
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalQuantity:N0}");
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalSales:N2}");
                                table.Cell().BorderBottom(0.5f).Padding(4).AlignRight().Text($"{route.TotalVariance:N2}")
                                    .FontColor(route.TotalVariance >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                            }

                            // Total row
                            table.Cell().BorderTop(0.5f).Padding(4).Text("TOTAL").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.TotalOrders}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.Routes.Sum(r => r.TotalQuantity):N0}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.TotalSales:N2}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(4).AlignRight().Text($"{data.TotalVariance:N2}").Bold()
                                .FontColor(data.TotalVariance >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                        });
                    }
                    else
                    {
                        col.Item().Padding(20).AlignCenter().Text("No orders found for this date.").FontColor(Colors.Grey.Medium);
                    }

                    // Variance analysis section
                    if (data.TotalVariance < 0)
                    {
                        col.Item().PaddingTop(10).Background(Colors.Red.Lighten4).Padding(5).Row(r =>
                        {
                            r.ConstantItem(20).Text("⚠️").FontSize(12);
                            r.RelativeItem().Text("NEGATIVE MARGIN ALERT: Total variance is negative. Review selling prices and base prices.").FontSize(8).FontColor(Colors.Red.Darken2);
                        });
                    }
                    else if (data.TotalVariance == 0)
                    {
                        col.Item().PaddingTop(10).Background(Colors.Grey.Lighten3).Padding(5).Row(r =>
                        {
                            r.ConstantItem(20).Text("ℹ️").FontSize(12);
                            r.RelativeItem().Text("Zero variance detected. All sales were at base price.").FontSize(8).FontColor(Colors.Grey.Darken2);
                        });
                    }

                    // Outstanding summary
                    col.Item().PaddingTop(10).BorderTop(0.5f).Row(r =>
                    {
                        r.RelativeItem().Text("Note: This report includes all submitted and closed orders for the day.");
                        if (!data.IsDayClosed)
                        {
                            r.RelativeItem().AlignRight().Text("Day is still OPEN - pending closure").FontSize(7).FontColor(Colors.Orange.Medium);
                        }
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