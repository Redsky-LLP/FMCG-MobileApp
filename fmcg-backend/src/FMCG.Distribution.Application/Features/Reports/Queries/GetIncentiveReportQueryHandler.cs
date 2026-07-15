using MediatR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Reports.DTOs;
using FMCG.Distribution.Domain.Enums;
using PdfUnit = QuestPDF.Infrastructure.Unit;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetIncentiveReportQueryHandler : IRequestHandler<GetIncentiveReportQuery, Result<byte[]>>
{
    private readonly IApplicationDbContext _context;

    public GetIncentiveReportQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<byte[]>> Handle(GetIncentiveReportQuery request, CancellationToken cancellationToken)
    {
        // ─── Step 1: Get date range ───
        var fromDate = request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var toDate = request.ToDate ?? DateTime.UtcNow.Date;

        Console.WriteLine($"🔵 Incentive Report: {fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}");

        // ─── Step 2: Get all active salesmen ───
        var salesmen = await _context.Users
            .Where(u => u.Role == UserRole.Salesman && u.IsActive && !u.IsDeleted)
            .ToListAsync(cancellationToken);

        if (salesmen.Count == 0)
        {
            return Result<byte[]>.Failure("No salesmen found.");
        }

        // ─── Step 3: Get CLOSED orders with items and products ───
        var orders = await _context.Orders
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .Where(o => !o.IsDeleted
                && o.SalesmanId != null
                && o.Status == OrderStatus.Closed
                && o.OrderDate.Date >= fromDate.Date
                && o.OrderDate.Date <= toDate.Date)
            .ToListAsync(cancellationToken);

        Console.WriteLine($"🔵 Orders found: {orders.Count}");

        // ─── Step 4: Prepare report data ───
        var reportData = new IncentiveReportDataDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            GeneratedAt = DateTime.UtcNow,
            Salesmen = new List<IncentiveReportItemDto>(),
            GrandTotalIncentive = 0,
            GrandTotalSales = 0,
            TotalSalesmen = salesmen.Count
        };

        // ─── Step 5: Calculate per salesman ───
        foreach (var salesman in salesmen)
        {
            var salesmanOrders = orders.Where(o => o.SalesmanId == salesman.Id).ToList();
            var totalSales = salesmanOrders.Sum(o => o.Items.Sum(i => i.SellingPrice * i.Quantity));
            var totalIncentive = 0m;

            foreach (var order in salesmanOrders)
            {
                foreach (var item in order.Items)
                {
                    if (item.ProductId == Guid.Empty || item.Product == null) continue;

                    // ─── GET INCENTIVE FROM PRODUCT ───
                    var incentive = item.Product.Incentive;

                    // ─── ONLY COUNT IF INCENTIVE > 0 ───
                    if (incentive.HasValue && incentive.Value > 0)
                    {
                        totalIncentive += item.Quantity * incentive.Value;
                    }
                }
            }

            reportData.Salesmen.Add(new IncentiveReportItemDto
            {
                SalesmanId = salesman.Id,
                SalesmanName = salesman.FullName,
                TotalOrders = salesmanOrders.Count,
                TotalSales = totalSales,
                TotalIncentive = totalIncentive
            });

            reportData.GrandTotalIncentive += totalIncentive;
            reportData.GrandTotalSales += totalSales;
        }

        // ─── Step 6: Sort by highest incentive ───
        reportData.Salesmen = reportData.Salesmen
            .OrderByDescending(s => s.TotalIncentive)
            .ToList();

        Console.WriteLine($"🔵 Total Incentive: {reportData.GrandTotalIncentive}");

        // ─── Step 7: Generate PDF ───
        var pdfBytes = GenerateIncentiveReportPdf(reportData);

        return Result<byte[]>.Success(pdfBytes);
    }

    private byte[] GenerateIncentiveReportPdf(IncentiveReportDataDto data)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0.5f, PdfUnit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(7).FontFamily("Arial"));

                // ─── Header ───
                page.Header()
                    .BorderBottom(0.5f)
                    .PaddingBottom(5)
                    .Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().Text("INCENTIVE REPORT").FontSize(14).Bold();
                            col.Item().Text($"Period: {data.FromDate:dd-MM-yyyy} to {data.ToDate:dd-MM-yyyy}");
                        });
                        row.RelativeItem().AlignRight().Column(col =>
                        {
                            col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                            col.Item().Text($"Total Incentive: ₹{data.GrandTotalIncentive:N2}");
                        });
                    });

                // ─── Content ───
                page.Content().Column(col =>
                {
                    // ─── Summary Cards ───
                    col.Item().PaddingTop(8).PaddingBottom(8).Row(summaryRow =>
                    {
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("SALESMEN").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.TotalSalesmen}").FontSize(12).Bold();
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("TOTAL INCENTIVE").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"₹{data.GrandTotalIncentive:N2}").FontSize(12).Bold()
                                .FontColor(Colors.Green.Medium);
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("TOTAL SALES").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"₹{data.GrandTotalSales:N2}").FontSize(12).Bold();
                        });
                    });

                    // ─── Salesmen Table ───
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3);  // Salesman
                            columns.RelativeColumn(1);  // Orders
                            columns.RelativeColumn(2);  // Total Sales
                            columns.RelativeColumn(2);  // Incentive
                        });

                        // ─── Table Header ───
                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("SALESMAN").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("ORDERS").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("TOTAL SALES").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("INCENTIVE").Bold();
                        });

                        // ─── Table Rows ───
                        foreach (var salesman in data.Salesmen)
                        {
                            table.Cell().BorderBottom(0.5f).Padding(3).Text(salesman.SalesmanName);
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{salesman.TotalOrders}");
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"₹{salesman.TotalSales:N2}");
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"₹{salesman.TotalIncentive:N2}")
                                .FontColor(salesman.TotalIncentive > 0 ? Colors.Green.Medium : Colors.Grey.Medium);
                        }

                        // ─── Total Row ───
                        table.Cell().BorderTop(0.5f).Padding(3).Text("TOTAL").Bold();
                        table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{data.Salesmen.Sum(s => s.TotalOrders)}").Bold();
                        table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"₹{data.GrandTotalSales:N2}").Bold();
                        table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"₹{data.GrandTotalIncentive:N2}").Bold()
                            .FontColor(Colors.Green.Medium);
                    });
                });

                // ─── Footer ───
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