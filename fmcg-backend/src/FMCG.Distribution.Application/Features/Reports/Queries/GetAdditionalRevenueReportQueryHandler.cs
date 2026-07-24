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

public class GetAdditionalRevenueReportQueryHandler : IRequestHandler<GetAdditionalRevenueReportQuery, Result<byte[]>>
{
    private readonly IApplicationDbContext _context;

    public GetAdditionalRevenueReportQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<byte[]>> Handle(GetAdditionalRevenueReportQuery request, CancellationToken cancellationToken)
    {
        var fromDate = request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var toDate = request.ToDate ?? DateTime.UtcNow.Date;

        Console.WriteLine($"🔵 Additional Revenue Report: {fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}");

        // Get all active salesmen
        var salesmen = await _context.Users
            .Where(u => u.Role == UserRole.Salesman && u.IsActive && !u.IsDeleted)
            .ToListAsync(cancellationToken);

        if (salesmen.Count == 0)
        {
            return Result<byte[]>.Failure("No salesmen found.");
        }

        var salesmanIds = salesmen.Select(s => s.Id).ToList();

        // Get closed orders within date range with product and customer details
        var orders = await _context.Orders
            .Include(o => o.Customer)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .Where(o => !o.IsDeleted
                && o.SalesmanId != null
                && salesmanIds.Contains(o.SalesmanId)
                && o.OrderDate.Date >= fromDate.Date
                && o.OrderDate.Date <= toDate.Date
                && o.Status == OrderStatus.Closed)
            .ToListAsync(cancellationToken);

        Console.WriteLine($"🔵 Orders found: {orders.Count}");

        var reportData = new AdditionalRevenueReportDataDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            GeneratedAt = DateTime.UtcNow,
            Items = new List<AdditionalRevenueReportItemDto>(),
            GrandTotalAdditionalRevenue = 0,
            TotalSalesmen = salesmen.Count
        };

        // ─── Calculate additional revenue for each order item ───
        foreach (var salesman in salesmen)
        {
            var salesmanOrders = orders.Where(o => o.SalesmanId == salesman.Id).ToList();

            foreach (var order in salesmanOrders)
            {
                foreach (var item in order.Items)
                {
                    if (item.ProductId == Guid.Empty) continue;
                    if (item.Product == null) continue;

                    var product = item.Product;

                    // ─── Get Unit Size from Product ───
                    var unitSize = product.UnitSize ?? 1;

                    // ─── Calculate Additional Revenue ───
                    // (Selling Price - Base Price) × Unit Size × Quantity
                    var priceDiff = item.SellingPrice - item.BasePriceAtTime;
                    var additionalRevenue = priceDiff * unitSize * item.Quantity;

                    // ─── Only include if additional revenue is not zero ───
                    if (additionalRevenue != 0)
                    {
                        reportData.Items.Add(new AdditionalRevenueReportItemDto
                        {
                            SalesmanId = salesman.Id,
                            SalesmanName = salesman.FullName,
                            CustomerName = order.Customer?.NameEnglish ?? "Unknown",
                            ProductName = product.NameEnglish,
                            Quantity = item.Quantity,
                            BasePrice = item.BasePriceAtTime,
                            SellingPrice = item.SellingPrice,
                            UnitSize = unitSize,
                            AdditionalRevenue = additionalRevenue
                        });

                        reportData.GrandTotalAdditionalRevenue += additionalRevenue;
                    }
                }
            }
        }

        // Sort by salesman name
        reportData.Items = reportData.Items
            .OrderBy(i => i.SalesmanName)
            .ThenBy(i => i.ProductName)
            .ToList();

        Console.WriteLine($"🔵 Total Additional Revenue: {reportData.GrandTotalAdditionalRevenue}");

        var pdfBytes = GenerateAdditionalRevenueReportPdf(reportData);
        return Result<byte[]>.Success(pdfBytes);
    }

    private byte[] GenerateAdditionalRevenueReportPdf(AdditionalRevenueReportDataDto data)
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
                            col.Item().Text("ADDITIONAL REVENUE REPORT").FontSize(14).Bold();
                            col.Item().Text($"Period: {data.FromDate:dd-MM-yyyy} to {data.ToDate:dd-MM-yyyy}");
                        });
                        //row.RelativeItem().AlignRight().Column(col =>
                        //{
                        //    col.Item().Text($"Generated: {data.GeneratedAt:dd-MM-yyyy HH:mm}");
                        //    col.Item().Text($"Total Additional Revenue: ₹{data.GrandTotalAdditionalRevenue:N2}");
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
                            c.Item().Text("TOTAL ADDITIONAL REVENUE").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"₹{data.GrandTotalAdditionalRevenue:N2}").FontSize(12).Bold()
                                .FontColor(data.GrandTotalAdditionalRevenue >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("ITEMS").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.Items.Count}").FontSize(12).Bold();
                        });
                    });

                    // ─── Main Table ───
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(2);  // Salesman
                            columns.RelativeColumn(2);  // Customer
                            columns.RelativeColumn(2);  // Product
                            columns.RelativeColumn(1);  // Qty
                            columns.RelativeColumn(1);  // Base Price
                            columns.RelativeColumn(1);  // Selling Price
                            columns.RelativeColumn(1);  // Unit Size
                            columns.RelativeColumn(2);  // Additional Revenue
                        });

                        // ─── Table Header ───
                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("SALESMAN").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("CUSTOMER").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).Text("PRODUCT").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("QTY").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("BASE").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("SELLING").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("UNIT SIZE").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).BorderBottom(0.5f).Padding(3).AlignRight().Text("ADDITIONAL REVENUE").Bold();
                        });

                        // ─── Table Rows ───
                        foreach (var item in data.Items)
                        {
                            var color = item.AdditionalRevenue >= 0 ? Colors.Green.Medium : Colors.Red.Medium;

                            table.Cell().BorderBottom(0.5f).Padding(3).Text(item.SalesmanName);
                            table.Cell().BorderBottom(0.5f).Padding(3).Text(item.CustomerName);
                            table.Cell().BorderBottom(0.5f).Padding(3).Text(item.ProductName);
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{item.Quantity:N0}");
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"₹{item.BasePrice:N2}");
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"₹{item.SellingPrice:N2}");
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"{item.UnitSize:N2}");
                            table.Cell().BorderBottom(0.5f).Padding(3).AlignRight().Text($"₹{item.AdditionalRevenue:N2}")
                                .FontColor(color);
                        }

                        // ─── Total Row ───
                        if (data.Items.Count > 0)
                        {
                            table.Cell().BorderTop(0.5f).Padding(3).Text("TOTAL").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).Text("").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).Text("").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"{data.Items.Sum(i => i.Quantity):N0}").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).Text("").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).Text("").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).Text("").Bold();
                            table.Cell().BorderTop(0.5f).Padding(3).AlignRight().Text($"₹{data.GrandTotalAdditionalRevenue:N2}").Bold()
                                .FontColor(data.GrandTotalAdditionalRevenue >= 0 ? Colors.Green.Medium : Colors.Red.Medium);
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