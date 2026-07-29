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

public class GetSummaryReportQueryHandler : IRequestHandler<GetSummaryReportQuery, Result<byte[]>>
{
    private readonly IApplicationDbContext _context;

    public GetSummaryReportQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<byte[]>> Handle(GetSummaryReportQuery request, CancellationToken cancellationToken)
    {
        var fromDate = request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var toDate = request.ToDate ?? DateTime.UtcNow.Date;

        Console.WriteLine($"🔵 Summary Report: {fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}");

        // Get closed orders with items, product groups, and size groups
        var orders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p!.ProductGroup)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p!.SizeGroup)
            .Where(o => !o.IsDeleted
                && o.OrderDate.Date >= fromDate.Date
                && o.OrderDate.Date <= toDate.Date
                && o.Status == OrderStatus.Closed)
            .ToListAsync(cancellationToken);

        Console.WriteLine($"🔵 Orders found: {orders.Count}");

        // Group by Item Group + Size Group
        var groupedData = new Dictionary<(string ItemGroup, string SizeGroup), SummaryReportItemDto>();

        foreach (var order in orders)
        {
            foreach (var item in order.Items)
            {
                if (item.ProductId == Guid.Empty) continue;
                if (item.Product == null) continue;

                var product = item.Product;
                var itemGroupName = product.ProductGroup?.Name ?? "Uncategorized";
                var sizeGroupName = product.SizeGroup?.Name ?? "No Size Group";

                var key = (ItemGroup: itemGroupName, SizeGroup: sizeGroupName);

                if (groupedData.ContainsKey(key))
                {
                    groupedData[key].TotalQuantity += item.Quantity;
                }
                else
                {
                    groupedData[key] = new SummaryReportItemDto
                    {
                        ItemGroupName = itemGroupName,
                        SizeGroupName = sizeGroupName,
                        TotalQuantity = item.Quantity
                    };
                }
            }
        }

        var reportData = new SummaryReportDataDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            GeneratedAt = DateTime.UtcNow,
            Items = groupedData.Values
                .OrderBy(i => i.ItemGroupName)
                .ThenBy(i => i.SizeGroupName)
                .ToList(),
            GrandTotalQuantity = groupedData.Values.Sum(i => i.TotalQuantity),
            TotalEntries = groupedData.Count
        };

        Console.WriteLine($"🔵 Total entries: {reportData.TotalEntries}");
        Console.WriteLine($"🔵 Grand Total Quantity: {reportData.GrandTotalQuantity}");

        var pdfBytes = GenerateSummaryReportPdf(reportData);
        return Result<byte[]>.Success(pdfBytes);
    }

    private byte[] GenerateSummaryReportPdf(SummaryReportDataDto data)
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
                            col.Item().Text("SUMMARY REPORT").FontSize(14).Bold();
                            col.Item().Text($"Period: {data.FromDate:dd-MM-yyyy} to {data.ToDate:dd-MM-yyyy}");
                        });
                        //row.RelativeItem().AlignRight().Column(col =>
                        //{
                        //    col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                        //    col.Item().Text($"Total Quantity: {data.GrandTotalQuantity:N0}");
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
                            c.Item().Text("TOTAL QUANTITY").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.GrandTotalQuantity:N0}").FontSize(12).Bold();
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("ENTRIES").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.TotalEntries}").FontSize(12).Bold();
                        });
                    });

                    // ─── Main Table ───
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3);  // Item Group
                            columns.RelativeColumn(3);  // Size Group
                            columns.RelativeColumn(2);  // Quantity
                        });

                        // ─── Table Header ───
                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("ITEM GROUP").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("SIZE GROUP").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("QUANTITY").Bold();
                        });

                        // ─── Table Rows ───
                        foreach (var item in data.Items)
                        {
                            table.Cell().BorderBottom(0.5f).Padding(3).Text(item.ItemGroupName.ToUpper());
                            table.Cell().BorderBottom(0.5f).Padding(3).Text(item.SizeGroupName.ToUpper());
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{item.TotalQuantity:N0}");
                        }

                        // ─── Total Row ───
                        if (data.Items.Count > 0)
                        {
                            table.Cell().BorderTop(0.5f).Padding(3).Text("TOTAL").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).Text("").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{data.GrandTotalQuantity:N0}").Bold();
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