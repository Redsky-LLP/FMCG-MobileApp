using System.Globalization;
using System.Text.RegularExpressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using PdfUnit = QuestPDF.Infrastructure.Unit;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

// BAG REPORT
// Route-wise bag count per day against each route's fixed Daily target, with a monthly
// total against the Monthly target, split by who took the order (Salesman / Admin).
// Same basis as the salesman screen: orders on the route by OrderDate (Indian time).
// Bag counting: 50 KG bag = 1 bag, 30 KG and 26 KG = 0.5 bag each.
public class GetBagReportQueryHandler : IRequestHandler<GetBagReportQuery, Result<byte[]>>
{
    private readonly IApplicationDbContext _context;

    public GetBagReportQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    // ── report model (private to this handler) ──
    private sealed class DayRow
    {
        public DateTime Date { get; set; }
        public decimal Bags50 { get; set; }
        public decimal Bags30 { get; set; }
        public decimal Bags26 { get; set; }
        public decimal SalesmanBags { get; set; }
        public decimal AdminBags { get; set; }
        public int SalesmanOrders { get; set; }
        public int AdminOrders { get; set; }
        public decimal Equivalent => Bags50 + 0.5m * (Bags30 + Bags26);
    }

    private sealed class MonthBlock
    {
        public DateTime Month { get; set; }
        public List<DayRow> Days { get; set; } = new();
        public decimal Total => Days.Sum(d => d.Equivalent);
        public decimal SalesmanTotal => Days.Sum(d => d.SalesmanBags);
        public decimal AdminTotal => Days.Sum(d => d.AdminBags);
        public int SalesmanOrders => Days.Sum(d => d.SalesmanOrders);
        public int AdminOrders => Days.Sum(d => d.AdminOrders);
    }

    private sealed class RouteBlock
    {
        public string RouteName { get; set; } = string.Empty;
        public int? DailyTarget { get; set; }
        public int? MonthlyTarget { get; set; }
        public List<MonthBlock> Months { get; set; } = new();
        public decimal Total => Months.Sum(m => m.Total);
        public decimal SalesmanTotal => Months.Sum(m => m.SalesmanTotal);
        public decimal AdminTotal => Months.Sum(m => m.AdminTotal);
    }

    private sealed record OrderBags(decimal B50, decimal B30, decimal B26, bool TakenByAdmin, Guid RouteId, DateTime LocalDate)
    {
        public decimal Equivalent => B50 + 0.5m * (B30 + B26);
    }

    public async Task<Result<byte[]>> Handle(GetBagReportQuery request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow.AddHours(5.5);   // Indian time
        var fromDate = (request.FromDate ?? new DateTime(now.Year, now.Month, 1)).Date;
        var toDate = (request.ToDate ?? now.Date).Date;
        var rangeEnd = toDate.AddDays(1);

        // 1) Every order on the route(s) in the date range (Indian time, UTC+5:30).
        var fromUtc = DateTime.SpecifyKind(fromDate.AddHours(-5.5), DateTimeKind.Utc);
        var toUtc = DateTime.SpecifyKind(rangeEnd.AddHours(-5.5), DateTimeKind.Utc);

        var orders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product!)
                    .ThenInclude(p => p.SizeGroup)
            .Where(o => !o.IsDeleted
                     && o.OrderDate >= fromUtc
                     && o.OrderDate < toUtc
                     && (request.RouteId == null || o.RouteId == request.RouteId))
            .ToListAsync(cancellationToken);

        // 2) Bag counts per order (orders with no bags are not part of this report).
        var bagOrders = new List<OrderBags>();
        foreach (var order in orders)
        {
            decimal b50 = 0, b30 = 0, b26 = 0;
            if (order.Items != null)
            {
                foreach (var item in order.Items)
                {
                    var sizeGroupName = item.SizeGroupNameAtTime ?? item.Product?.SizeGroup?.Name;
                    var qty = (decimal)item.Quantity;
                    if (MatchesSizeGroupWeight(sizeGroupName, 50)) b50 += qty;
                    else if (MatchesSizeGroupWeight(sizeGroupName, 30)) b30 += qty;
                    else if (MatchesSizeGroupWeight(sizeGroupName, 26)) b26 += qty;
                }
            }

            var ob = new OrderBags(b50, b30, b26, order.TakenByAdmin, order.RouteId,
                order.OrderDate.AddHours(5.5));
            if (ob.Equivalent > 0) bagOrders.Add(ob);
        }

        // 3) Routes (names + fixed targets).
        var routes = await _context.Routes
            .AsNoTracking()
            .Where(r => !r.IsDeleted && (request.RouteId == null || r.Id == request.RouteId))
            .Select(r => new { r.Id, r.Name, r.DailyBagTarget, r.MonthlyBagTarget })
            .ToListAsync(cancellationToken);

        // 4) Build route -> month -> day.
        var blocks = new List<RouteBlock>();
        foreach (var route in routes.OrderBy(r => r.Name))
        {
            var block = new RouteBlock
            {
                RouteName = route.Name,
                DailyTarget = route.DailyBagTarget,
                MonthlyTarget = route.MonthlyBagTarget
            };

            var routeOrders = bagOrders.Where(o => o.RouteId == route.Id).ToList();

            foreach (var monthGroup in routeOrders
                .GroupBy(o => new DateTime(o.LocalDate.Year, o.LocalDate.Month, 1))
                .OrderBy(g => g.Key))
            {
                var month = new MonthBlock { Month = monthGroup.Key };
                foreach (var dayGroup in monthGroup.GroupBy(o => o.LocalDate.Date).OrderBy(g => g.Key))
                {
                    var day = new DayRow { Date = dayGroup.Key };
                    foreach (var o in dayGroup)
                    {
                        day.Bags50 += o.B50;
                        day.Bags30 += o.B30;
                        day.Bags26 += o.B26;
                        if (o.TakenByAdmin) { day.AdminBags += o.Equivalent; day.AdminOrders++; }
                        else { day.SalesmanBags += o.Equivalent; day.SalesmanOrders++; }
                    }
                    month.Days.Add(day);
                }
                block.Months.Add(month);
            }

            // keep a route in the report if it has orders or a target
            if (block.Months.Count > 0 || block.DailyTarget != null || block.MonthlyTarget != null)
                blocks.Add(block);
        }

        var pdf = GeneratePdf(blocks, fromDate, toDate);
        return Result<byte[]>.Success(pdf);
    }

    // 50 KG / 30 KG / 26 KG match on size-group names like "50 KG BAG" or "50 KG"
    private static bool MatchesSizeGroupWeight(string? sizeGroupName, int kg)
        => sizeGroupName != null && Regex.IsMatch(sizeGroupName, $@"\b{kg}\s*kg\b", RegexOptions.IgnoreCase);

    private static string Bags(decimal v) => v.ToString("0.#", CultureInfo.InvariantCulture);

    private static string VsTarget(decimal count, int? target)
        => target is > 0 ? $"{Bags(count)}/{target}" : Bags(count);

    private static string StatusColor(decimal count, int? target)
        => target is > 0 && count >= target ? Colors.Green.Medium : Colors.Black;

    private static byte[] GeneratePdf(List<RouteBlock> blocks, DateTime fromDate, DateTime toDate)
    {
        var grandTotal = blocks.Sum(b => b.Total);
        var grandSalesman = blocks.Sum(b => b.SalesmanTotal);
        var grandAdmin = blocks.Sum(b => b.AdminTotal);

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
                        col.Item().Text("BAG REPORT").FontSize(14).Bold();
                        col.Item().Text($"Period: {fromDate:dd-MM-yyyy} to {toDate:dd-MM-yyyy}");
                    });

                // ─── Content ───
                page.Content().Column(col =>
                {
                    col.Spacing(6);

                    // Summary cards
                    col.Item().PaddingTop(8).Row(row =>
                    {
                        row.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("ROUTES").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text($"{blocks.Count}").FontSize(12).Bold();
                        });
                        row.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("TOTAL BAGS").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text(Bags(grandTotal)).FontSize(12).Bold();
                        });
                        row.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("SALESMAN BAGS").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text(Bags(grandSalesman)).FontSize(12).Bold();
                        });
                        row.RelativeItem().Border(0.5f).Padding(5).Column(c =>
                        {
                            c.Item().Text("ADMIN BAGS").FontSize(7).FontColor(Colors.Grey.Medium);
                            c.Item().Text(Bags(grandAdmin)).FontSize(12).Bold();
                        });
                    });

                    if (blocks.Count == 0)
                    {
                        col.Item().PaddingTop(10).Text("No orders found for the selected period.");
                    }

                    foreach (var route in blocks)
                    {
                        // Route band: name left, fixed targets right
                        col.Item().EnsureSpace(80).Background(Colors.Grey.Lighten3).Padding(4).Row(r =>
                        {
                            r.RelativeItem().Text($"ROUTE: {route.RouteName.ToUpper()}").FontSize(9).Bold();
                            var daily = route.DailyTarget is > 0 ? route.DailyTarget.ToString() : "-";
                            var monthly = route.MonthlyTarget is > 0 ? route.MonthlyTarget.ToString() : "-";
                            r.AutoItem().Text($"Daily target: {daily}   |   Monthly target: {monthly}").Bold();
                        });

                        if (route.Months.Count == 0)
                        {
                            col.Item().PaddingLeft(4).Text("No orders in this period.").FontColor(Colors.Grey.Medium);
                            continue;
                        }

                        foreach (var month in route.Months)
                        {
                            // Month band: month left, monthly total vs target right
                            col.Item().EnsureSpace(60).Background(Colors.Grey.Lighten4).PaddingVertical(3).PaddingHorizontal(4).Row(r =>
                            {
                                r.RelativeItem().Text($"— {month.Month.ToString("MMMM yyyy", CultureInfo.InvariantCulture)} —").Bold();
                                r.AutoItem().Text($"Monthly: {VsTarget(month.Total, route.MonthlyTarget)}   (Salesman {Bags(month.SalesmanTotal)} · Admin {Bags(month.AdminTotal)})").Bold()
                                    .FontColor(StatusColor(month.Total, route.MonthlyTarget));
                            });

                            col.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn(1.7f);  // Date
                                    columns.RelativeColumn(0.9f);  // 50 KG
                                    columns.RelativeColumn(0.9f);  // 30 KG
                                    columns.RelativeColumn(0.9f);  // 26 KG
                                    columns.RelativeColumn(1.1f);  // Salesman bags
                                    columns.RelativeColumn(1.1f);  // Admin bags
                                    columns.RelativeColumn(1.1f);  // Total bags
                                    columns.RelativeColumn(1.4f);  // Orders (salesman / admin)
                                    columns.RelativeColumn(1.4f);  // Daily vs target
                                });

                                table.Header(h =>
                                {
                                    h.Cell().BorderBottom(0.5f).Padding(2).Text("DATE").Bold();
                                    h.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("50 KG").Bold();
                                    h.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("30 KG").Bold();
                                    h.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("26 KG").Bold();
                                    h.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("SALESMAN").Bold();
                                    h.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("ADMIN").Bold();
                                    h.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("TOTAL").Bold();
                                    h.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("ORDERS (S / A)").Bold();
                                    h.Cell().BorderBottom(0.5f).Padding(2).AlignRight().Text("DAILY").Bold();
                                });

                                foreach (var day in month.Days)
                                {
                                    table.Cell().BorderBottom(0.25f).Padding(2).Text($"{day.Date:dd-MM-yyyy}");
                                    table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text(Bags(day.Bags50));
                                    table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text(Bags(day.Bags30));
                                    table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text(Bags(day.Bags26));
                                    table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text(Bags(day.SalesmanBags));
                                    table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text(Bags(day.AdminBags));
                                    table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text(Bags(day.Equivalent)).Bold();
                                    table.Cell().BorderBottom(0.25f).Padding(2).AlignRight().Text($"{day.SalesmanOrders} / {day.AdminOrders}");
                                    table.Cell().BorderBottom(0.25f).Padding(2).AlignRight()
                                        .Text(VsTarget(day.Equivalent, route.DailyTarget))
                                        .FontColor(StatusColor(day.Equivalent, route.DailyTarget));
                                }

                                // month total row
                                table.Cell().BorderTop(0.5f).Padding(2).Text("MONTH TOTAL").Bold();
                                table.Cell().BorderTop(0.5f).Padding(2).AlignRight().Text(Bags(month.Days.Sum(d => d.Bags50))).Bold();
                                table.Cell().BorderTop(0.5f).Padding(2).AlignRight().Text(Bags(month.Days.Sum(d => d.Bags30))).Bold();
                                table.Cell().BorderTop(0.5f).Padding(2).AlignRight().Text(Bags(month.Days.Sum(d => d.Bags26))).Bold();
                                table.Cell().BorderTop(0.5f).Padding(2).AlignRight().Text(Bags(month.SalesmanTotal)).Bold();
                                table.Cell().BorderTop(0.5f).Padding(2).AlignRight().Text(Bags(month.AdminTotal)).Bold();
                                table.Cell().BorderTop(0.5f).Padding(2).AlignRight().Text(Bags(month.Total)).Bold();
                                table.Cell().BorderTop(0.5f).Padding(2).AlignRight().Text($"{month.SalesmanOrders} / {month.AdminOrders}").Bold();
                                table.Cell().BorderTop(0.5f).Padding(2).AlignRight()
                                    .Text(VsTarget(month.Total, route.MonthlyTarget)).Bold()
                                    .FontColor(StatusColor(month.Total, route.MonthlyTarget));
                            });
                        }
                    }

                    if (blocks.Count > 0)
                    {
                        col.Item().BorderTop(0.5f).PaddingTop(4).Row(r =>
                        {
                            r.RelativeItem().Text("GRAND TOTAL (ALL ROUTES)").FontSize(9).Bold();
                            r.AutoItem().Text($"{Bags(grandTotal)} bags   (Salesman {Bags(grandSalesman)} · Admin {Bags(grandAdmin)})").FontSize(9).Bold();
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
                    });
            });
        }).GeneratePdf();
    }
}