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
        var fromDate = request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var toDate = request.ToDate ?? DateTime.UtcNow.Date;

        // Get all active salesmen
        var salesmen = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.Salesman && u.IsActive && !u.IsDeleted)
            .ToListAsync(cancellationToken);

        if (salesmen.Count == 0)
        {
            return Result<byte[]>.Failure("No salesmen found.");
        }

        var salesmanIds = salesmen.Select(s => s.Id).ToList();

        // Get closed orders within date range with product details
        var orders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .Where(o => !o.IsDeleted
                && o.SalesmanId != null
                && salesmanIds.Contains(o.SalesmanId)
                && o.OrderDate.Date >= fromDate.Date
                && o.OrderDate.Date <= toDate.Date
                && o.Status == OrderStatus.Closed)
            .ToListAsync(cancellationToken);

        var reportData = new IncentiveReportDataDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            GeneratedAt = DateTime.UtcNow,
            Incentives = new List<IncentiveReportItemDto>(),
            GrandTotalIncentive = 0,
            TotalSalesmen = salesmen.Count
        };

        // ─── Group by Salesman + Product ───
        var groupedIncentives = new Dictionary<(Guid SalesmanId, Guid ProductId), IncentiveReportItemDto>();

        foreach (var salesman in salesmen)
        {
            var salesmanOrders = orders.Where(o => o.SalesmanId == salesman.Id).ToList();

            foreach (var order in salesmanOrders)
            {
                foreach (var item in order.Items)
                {
                    if (item.ProductId == Guid.Empty) continue;
                    if (item.Product == null) continue;

                    var incentive = item.Product.Incentive;

                    if (incentive.HasValue && incentive.Value > 0)
                    {
                        var key = (SalesmanId: salesman.Id, ProductId: item.ProductId);
                        var earned = item.Quantity * incentive.Value;

                        if (groupedIncentives.ContainsKey(key))
                        {
                            // ── Add to existing entry ──
                            groupedIncentives[key].Quantity += item.Quantity;
                            groupedIncentives[key].IncentiveEarned += earned;
                        }
                        else
                        {
                            // ── Create new entry ──
                            groupedIncentives[key] = new IncentiveReportItemDto
                            {
                                SalesmanId = salesman.Id,
                                SalesmanName = salesman.FullName,
                                ProductName = item.Product.NameEnglish,
                                Quantity = item.Quantity,
                                IncentiveEarned = earned
                            };
                        }

                        reportData.GrandTotalIncentive += earned;
                    }
                }
            }
        }

        // Convert to list and sort
        reportData.Incentives = groupedIncentives.Values
            .OrderBy(i => i.SalesmanName)
            .ThenBy(i => i.ProductName)
            .ToList();

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
                        //row.RelativeItem().AlignRight().Column(col =>
                        //{
                        //    col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                        //    col.Item().Text($"Total Incentive: ₹{data.GrandTotalIncentive:N2}");
                        //});
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
                            c.Item().Text("PRODUCTS").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.Incentives.Count}").FontSize(12).Bold();
                        });
                    });

                    // ─── Group by Salesman ───
                    var groupedBySalesman = data.Incentives
                        .GroupBy(i => i.SalesmanName)
                        .OrderBy(g => g.Key)
                        .ToList();

                    // ─── Table ───
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3);  // Salesman
                            columns.RelativeColumn(3);  // Product
                            columns.RelativeColumn(1);  // Quantity
                            columns.RelativeColumn(2);  // Incentive
                        });

                        // ─── Table Header ───
                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("SALESMAN").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("PRODUCT").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("QTY").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("INCENTIVE").Bold();
                        });

                        // ─── Table Rows ───
                        bool isFirstRow = true;

                        foreach (var salesmanGroup in groupedBySalesman)
                        {
                            var salesmanName = salesmanGroup.Key;
                            var salesmenTotal = salesmanGroup.Sum(i => i.IncentiveEarned);

                            foreach (var item in salesmanGroup)
                            {
                                // ─── Show salesman name only once ───
                                if (isFirstRow)
                                {
                                    table.Cell().BorderBottom(0.5f).Padding(3).Text(salesmanName);
                                    isFirstRow = false;
                                }
                                else
                                {
                                    table.Cell().BorderBottom(0.5f).Padding(3).Text("");
                                }

                                table.Cell().BorderBottom(0.5f).Padding(3).Text(item.ProductName);
                                table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{item.Quantity:N0}");
                                table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"₹{item.IncentiveEarned:N2}")
                                    .FontColor(Colors.Green.Medium);
                            }

                            // ─── Subtotal for this salesman ───
                            table.Cell().BorderBottom(0.5f).Padding(3).Text("").Bold();
                            table.Cell().BorderBottom(0.5f).Padding(3).Text($"Subtotal - {salesmanName}").Bold();
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text("").Bold();
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"₹{salesmenTotal:N2}").Bold()
                                .FontColor(Colors.Green.Medium);

                            // ─── Reset for next salesman ───
                            isFirstRow = true;
                        }

                        // ─── Grand Total Row ───
                        if (data.Incentives.Count > 0)
                        {
                            table.Cell().BorderTop(0.5f).Padding(3).Text("TOTAL").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).Text("").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{data.Incentives.Sum(i => i.Quantity):N0}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"₹{data.GrandTotalIncentive:N2}").Bold()
                                .FontColor(Colors.Green.Medium);
                        }
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