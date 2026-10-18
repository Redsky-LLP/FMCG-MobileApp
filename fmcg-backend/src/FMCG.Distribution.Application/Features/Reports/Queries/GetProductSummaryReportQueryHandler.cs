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

        // ── NEW: view mode — "summary" (default) | "product" | "sizegroup" | "category" ──
        var viewMode = (request.GroupBy ?? string.Empty).Trim().ToLowerInvariant();
        if (viewMode != "product" && viewMode != "sizegroup" && viewMode != "category")
            viewMode = "summary";

        Console.WriteLine($"🔵 Summary Report: {fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd} | view: {viewMode}");

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

        // Group according to the selected view:
        //   summary   -> Item Group + Size Group   (original behaviour)
        //   product   -> Product (+ its Item Group and Size Group)
        //   sizegroup -> Size Group only
        //   category  -> Item Group (Category) only
        var groupedData = new Dictionary<(string Product, string ItemGroup, string SizeGroup), SummaryReportItemDto>();

        foreach (var order in orders)
        {
            foreach (var item in order.Items)
            {
                if (item.ProductId == Guid.Empty) continue;
                if (item.Product == null) continue;

                var product = item.Product;

                var itemGroupName = product.ProductGroup?.Name ?? "Uncategorized";
                var sizeGroupName = product.SizeGroup?.Name ?? "No Size Group";

                var productKey = viewMode == "product" ? (product.NameEnglish ?? "-") : string.Empty;
                var itemGroupKey = viewMode == "sizegroup" ? string.Empty : itemGroupName;
                var sizeGroupKey = viewMode == "category" ? string.Empty : sizeGroupName;

                var key = (Product: productKey, ItemGroup: itemGroupKey, SizeGroup: sizeGroupKey);

                if (groupedData.ContainsKey(key))
                {
                    groupedData[key].TotalQuantity += item.Quantity;
                }
                else
                {
                    groupedData[key] = new SummaryReportItemDto
                    {
                        ProductName = productKey,
                        ItemGroupName = itemGroupKey,
                        SizeGroupName = sizeGroupKey,
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
            ViewMode = viewMode,
            Items = groupedData.Values
                .OrderBy(i => i.ItemGroupName)
                .ThenBy(i => i.SizeGroupName)
                .ThenBy(i => i.ProductName)
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
        // Which columns to show for the selected view
        var showProduct = data.ViewMode == "product";
        var showItemGroup = data.ViewMode != "sizegroup";
        var showSizeGroup = data.ViewMode != "category";
        var itemGroupHeader = data.ViewMode == "category" ? "CATEGORY" : "ITEM GROUP";

        var viewLabel = data.ViewMode switch
        {
            "product" => "View: By Product",
            "sizegroup" => "View: By Size Group",
            "category" => "View: By Category",
            _ => string.Empty
        };

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
                        row.RelativeItem().AlignRight().Column(col =>
                        {
                            col.Item().Text("SUMMARY REPORT").FontSize(14).Bold();
                            col.Item().Text($"Period: {data.FromDate:dd-MM-yyyy} to {data.ToDate:dd-MM-yyyy}");

                            if (!string.IsNullOrEmpty(viewLabel))
                            {
                                col.Item().Text(viewLabel).FontColor(Colors.Grey.Darken1);
                            }
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
                            if (showProduct) columns.RelativeColumn(4);  // Product
                            if (showItemGroup) columns.RelativeColumn(3);  // Item Group / Category
                            if (showSizeGroup) columns.RelativeColumn(3);  // Size Group
                            columns.RelativeColumn(2);                     // Quantity
                        });

                        // ─── Table Header ───
                        table.Header(header =>
                        {
                            if (showProduct)
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("PRODUCT").Bold();
                            if (showItemGroup)
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text(itemGroupHeader).Bold();
                            if (showSizeGroup)
                                header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("SIZE GROUP").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("QUANTITY").Bold();
                        });

                        // ─── Table Rows ───
                        foreach (var item in data.Items)
                        {
                            if (showProduct)
                                table.Cell().BorderBottom(0.5f).Padding(3).Text(item.ProductName.ToUpper());
                            if (showItemGroup)
                                table.Cell().BorderBottom(0.5f).Padding(3).Text(item.ItemGroupName.ToUpper());
                            if (showSizeGroup)
                                table.Cell().BorderBottom(0.5f).Padding(3).Text(item.SizeGroupName.ToUpper());
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{item.TotalQuantity:N0}");
                        }

                        // ─── Total Row ───
                        if (data.Items.Count > 0)
                        {
                            // "TOTAL" goes in the first column, other label columns stay empty
                            var labelColumns = (showProduct ? 1 : 0) + (showItemGroup ? 1 : 0) + (showSizeGroup ? 1 : 0);
                            for (var i = 0; i < labelColumns; i++)
                            {
                                table.Cell().BorderTop(0.5f).Padding(3).Text(i == 0 ? "TOTAL" : "").Bold();
                            }
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