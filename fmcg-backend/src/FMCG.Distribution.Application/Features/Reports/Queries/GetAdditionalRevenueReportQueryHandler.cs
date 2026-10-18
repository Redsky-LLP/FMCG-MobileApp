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

        // Closed orders within the date range (report is customer/date based,
        // so it no longer depends on salesmen at all).
        var orders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .Where(o => !o.IsDeleted
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
            GrandTotalAdditionalRevenue = 0
        };

        // ─── Calculate additional revenue for each order item ───
        foreach (var order in orders)
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
                        CustomerId = order.CustomerId,
                        CustomerName = order.Customer?.NameEnglish ?? "Unknown",
                        OrderDate = order.OrderDate.Date,
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

        // Sort by customer, then date, then product
        reportData.Items = reportData.Items
            .OrderBy(i => i.CustomerName)
            .ThenBy(i => i.OrderDate)
            .ThenBy(i => i.ProductName)
            .ToList();

        reportData.TotalCustomers = reportData.Items
            .Select(i => i.CustomerId)
            .Distinct()
            .Count();

        Console.WriteLine($"🔵 Total Additional Revenue: {reportData.GrandTotalAdditionalRevenue}");

        var pdfBytes = GenerateAdditionalRevenueReportPdf(reportData);
        return Result<byte[]>.Success(pdfBytes);
    }

    private byte[] GenerateAdditionalRevenueReportPdf(AdditionalRevenueReportDataDto data)
    {
        // Customer -> Date -> Items  (customers A-Z, dates oldest first)
        var customerGroups = data.Items
            .GroupBy(i => new { i.CustomerId, i.CustomerName })
            .OrderBy(g => g.Key.CustomerName)
            .ToList();

        static string Money(decimal v) => $"₹{v:N2}";
        static string MoneyColor(decimal v) => v >= 0 ? Colors.Green.Medium : Colors.Red.Medium;

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
                    .AlignRight()
                    .Column(col =>
                    {
                        col.Item().Text("ADDITIONAL REVENUE REPORT").FontSize(14).Bold();
                        col.Item().Text($"Period: {data.FromDate:dd-MM-yyyy} to {data.ToDate:dd-MM-yyyy}");
                    });

                // ─── Content ───
                page.Content().Column(col =>
                {
                    col.Spacing(6);

                    // ─── Summary Cards ───
                    col.Item().PaddingTop(8).Row(summaryRow =>
                    {
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("CUSTOMERS").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.TotalCustomers}").FontSize(12).Bold();
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("TOTAL ADDITIONAL REVENUE").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text(Money(data.GrandTotalAdditionalRevenue)).FontSize(12).Bold()
                                .FontColor(MoneyColor(data.GrandTotalAdditionalRevenue));
                        });
                        summaryRow.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("ITEMS").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{data.Items.Count}").FontSize(12).Bold();
                        });
                    });

                    // ─── One block per customer ───
                    // Each date block (date band + its table) is kept together, and the customer
                    // band travels with the FIRST date block of that customer. A band can no longer
                    // be left alone at the bottom of a page while its table starts on the next page.
                    foreach (var customer in customerGroups)
                    {
                        var customerTotal = customer.Sum(i => i.AdditionalRevenue);
                        var dateGroups = customer.GroupBy(i => i.OrderDate.Date).OrderBy(g => g.Key).ToList();
                        var isFirstDay = true;

                        foreach (var day in dateGroups)
                        {
                            var daySubtotal = day.Sum(i => i.AdditionalRevenue);
                            var dayItems = day.OrderBy(i => i.ProductName).ToList();
                            var showCustomerBand = isFirstDay;
                            isFirstDay = false;

                            // Minimum room needed to start this block on the current page:
                            // bands + table header + the first (up to 3) rows. If it does not fit,
                            // the whole block starts on the next page. Longer tables still continue
                            // onto following pages as before (the table header repeats).
                            var minHeight = (showCustomerBand ? 22 : 0) + 18 + 16 + Math.Min(dayItems.Count, 3) * 15;

                            col.Item().EnsureSpace(minHeight).Column(block =>
                            {
                                block.Spacing(6);

                                if (showCustomerBand)
                                {
                                    // Customer band: name on the left, total on the right
                                    block.Item().Background(Colors.Grey.Lighten3).Padding(4).Row(r =>
                                    {
                                        r.RelativeItem().Text($"CUSTOMER: {customer.Key.CustomerName.ToUpper()}").FontSize(9).Bold();
                                        r.AutoItem().Text($"Total: {Money(customerTotal)}").FontSize(8).Bold()
                                            .FontColor(MoneyColor(customerTotal));
                                    });
                                }

                                // Date band: date on the left, subtotal on the right
                                block.Item().Background(Colors.Grey.Lighten4).PaddingVertical(3).PaddingHorizontal(4).Row(r =>
                                {
                                    r.RelativeItem().Text($"— {day.Key:dd-MM-yyyy} —").Bold();
                                    r.AutoItem().Text($"Subtotal: {Money(daySubtotal)}").Bold()
                                        .FontColor(MoneyColor(daySubtotal));
                                });

                                // Items table for that date (no salesman column)
                                block.Item().Table(table =>
                                {
                                    table.ColumnsDefinition(columns =>
                                    {
                                        columns.RelativeColumn(4);  // Product
                                        columns.RelativeColumn(1);  // Qty
                                        columns.RelativeColumn(1.3f); // Base
                                        columns.RelativeColumn(1.3f); // Selling
                                        columns.RelativeColumn(1.2f); // Unit size
                                        columns.RelativeColumn(1.6f); // Add. revenue
                                    });

                                    table.Header(header =>
                                    {
                                        header.Cell().BorderBottom(0.5f).Padding(2).Text("PRODUCT").Bold();
                                        header.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("QTY").Bold();
                                        header.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("BASE").Bold();
                                        header.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("SELLING").Bold();
                                        header.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("UNIT SIZE").Bold();
                                        header.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("ADD. REVENUE").Bold();
                                    });

                                    foreach (var item in dayItems)
                                    {
                                        table.Cell().BorderBottom(0.25f).Padding(2).Text(item.ProductName.ToUpper());
                                        table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text($"{item.Quantity:N0}");
                                        table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text(Money(item.BasePrice));
                                        table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text(Money(item.SellingPrice));
                                        table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text($"{item.UnitSize:N2}");
                                        table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text(Money(item.AdditionalRevenue))
                                            .FontColor(MoneyColor(item.AdditionalRevenue));
                                    }
                                });
                            });
                        }
                    }

                    // ─── Grand Total ───
                    if (data.Items.Count > 0)
                    {
                        col.Item().BorderTop(0.5f).PaddingTop(4).Row(r =>
                        {
                            r.RelativeItem().Text("GRAND TOTAL").FontSize(9).Bold();
                            r.AutoItem().Text(Money(data.GrandTotalAdditionalRevenue)).FontSize(9).Bold()
                                .FontColor(MoneyColor(data.GrandTotalAdditionalRevenue));
                        });
                    }
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
                        x.Span($" | Generated: {data.GeneratedAt:HH:mm:ss}");
                    });
            });
        }).GeneratePdf();
    }
}