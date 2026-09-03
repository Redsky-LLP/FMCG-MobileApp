// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetRetailSheetQueryHandler.cs
//
// NEW: Retail Sheet report — same overall shape as the Loading Sheet (route
// filter, date filter, grouped by route, customer stop numbering matching
// their assigned delivery sequence), but scoped to ONLY retail items: orders
// with zero products and a non-empty Remarks note. Same "Closed or Locked
// orders only" rule as every other finalized report in this app (Loading
// Sheet, Billing Sheet) — this is a production/reference document generated
// after the day's orders are finalized, not a live in-progress tracker.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Reports.DTOs;
using FMCG.Distribution.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using PdfUnit = QuestPDF.Infrastructure.Unit;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetRetailSheetQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetRetailSheetQuery, Result<byte[]>>
{
    public async Task<Result<byte[]>> Handle(GetRetailSheetQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var targetDate = request.Date?.Date ?? DateTime.UtcNow.Date;

            // ── FIX: "retail items" are the free-text remarks a salesman jots down for
            // non-catalog items — matched by remarks alone, regardless of whether that
            // same order also has real catalog products on it. The original spec's
            // literal "zero items AND remarks" definition returned nothing against real
            // data, because remarks are typically attached to orders that ALSO have
            // regular products (e.g. a customer's usual rice order plus a note for
            // "2kg carrots, 1kg beetroot"). This matches the same widened rule already
            // applied to the Loading Sheet's retail-items handling, for consistency —
            // this report only DISPLAYS the remarks text either way, never the order's
            // regular items, so it stays focused on retail items specifically. ──
            var retailOrdersQuery = context.Orders
                .AsNoTracking()
                .Include(o => o.Customer)
                .Include(o => o.Route)
                .Where(o => !o.IsDeleted
                    && (o.Status == OrderStatus.Closed || o.IsLocked)
                    && o.OrderDate.Date == targetDate.Date
                    && !string.IsNullOrWhiteSpace(o.Remarks));

            if (request.RouteId.HasValue)
            {
                retailOrdersQuery = retailOrdersQuery.Where(o => o.RouteId == request.RouteId.Value);
            }

            var retailOrders = await retailOrdersQuery.ToListAsync(cancellationToken);

            if (retailOrders.Count == 0)
            {
                var emptyPdf = GenerateEmptyRetailSheet(
                    targetDate,
                    request.RouteId.HasValue ? "No retail items found for the selected route/date." : "No retail items found for this date."
                );
                return Result<byte[]>.Success(emptyPdf);
            }

            // ── Group by route, customers ordered by their assigned delivery sequence —
            // same convention as the Loading Sheet, so stop numbers stay consistent
            // between the two reports for the same route/day. ──
            var routeGroups = retailOrders
                .Where(o => o.Route != null)
                .GroupBy(o => new { o.RouteId, RouteName = o.Route?.Name ?? "Unknown" })
                .OrderBy(g => g.Key.RouteName)
                .ToList();

            var routes = new List<RetailSheetRouteDto>();
            foreach (var routeGroup in routeGroups)
            {
                // ── FIX: was grouping by ORDER, not by customer — if a customer had more
                // than one order with remarks on the same date (e.g. one order edited
                // into a second one, or genuinely two separate orders), each order became
                // its own entry, showing that customer multiple times on the sheet. Now
                // grouped by customer first, so each customer gets exactly ONE entry per
                // day, with remarks from all of their orders that day combined together. ──
                var groupedByCustomer = routeGroup
                    .GroupBy(o => o.CustomerId)
                    .Select(g => new
                    {
                        Customer = g.First().Customer,
                        SequenceOrder = g.First().Customer?.SequenceOrder ?? 0,
                        CombinedRemarks = string.Join("\n", g
                            .Select(o => o.Remarks)
                            .Where(r => !string.IsNullOrWhiteSpace(r))),
                    })
                    .OrderBy(x => x.SequenceOrder)
                    .ToList();

                var orders = new List<RetailSheetOrderDto>();
                var stopNumber = 1;
                foreach (var group in groupedByCustomer)
                {
                    orders.Add(new RetailSheetOrderDto
                    {
                        SequenceOrder = stopNumber,
                        CustomerName = group.Customer?.NameEnglish ?? "Unknown Customer",
                        Remarks = group.CombinedRemarks,
                    });
                    stopNumber++;
                }

                routes.Add(new RetailSheetRouteDto
                {
                    RouteName = routeGroup.Key.RouteName,
                    Orders = orders,
                });
            }

            var isSingleRoute = request.RouteId.HasValue;
            var pdfBytes = GenerateRetailSheetPdf(routes, targetDate, isSingleRoute);
            return Result<byte[]>.Success(pdfBytes);
        }
        catch (Exception ex)
        {
            return Result<byte[]>.Failure($"Failed to generate retail sheet: {ex.Message}");
        }
    }

    private static byte[] GenerateRetailSheetPdf(List<RetailSheetRouteDto> routes, DateTime targetDate, bool isSingleRoute)
    {
        try
        {
            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(0.5f, PdfUnit.Centimetre);
                    page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Liberation Serif"));

                    // ── Header ──
                    page.Header()
                        .BorderBottom(0.5f)
                        .PaddingBottom(5)
                        .Column(col =>
                        {
                            col.Item().Text("📝 RETAIL SHEET").FontSize(16).Bold().Underline();
                            col.Item().Text($"Date: {targetDate:dd-MM-yyyy}").FontSize(10);
                            if (isSingleRoute && routes.Count == 1)
                            {
                                col.Item().Text($"Route: {routes[0].RouteName.ToUpper()}").FontSize(11).Bold();
                            }
                        });

                    // ── Content ──
                    page.Content().Column(contentCol =>
                    {
                        foreach (var route in routes)
                        {
                            contentCol.Item().PaddingTop(10).Column(routeCol =>
                            {
                                routeCol.Item().Background(Colors.Grey.Lighten2)
                                    .Padding(6)
                                    .AlignCenter()
                                    .Text($"{route.RouteName.ToUpper()}").FontSize(18).Bold();

                                foreach (var order in route.Orders)
                                {
                                    // Same visual language as the Loading Sheet's per-stop banner and
                                    // the retail-items block that used to appear inline there — kept
                                    // consistent so this reads as "the same data, filtered" rather than
                                    // a differently-styled report.
                                    //
                                    // FIX: removed ShowEntire() — it forced each customer's block to
                                    // render only if it fit without splitting across a page boundary.
                                    // Small local test datasets always happened to fit, but real
                                    // production data (longer remarks, more customers per route) could
                                    // produce a block too large to fit in the remaining page space or
                                    // even a fresh page, which QuestPDF surfaces as a hard layout
                                    // exception — the "failing to load" error in production. Dropping
                                    // ShowEntire lets QuestPDF paginate this block normally, same as
                                    // every other element in this report.
                                    //
                                    // FIX: gap between customers reduced from 2cm down to 10pt.
                                    routeCol.Item().PaddingTop(10).Column(orderCol =>
                                    {
                                        orderCol.Item().Background(Colors.Grey.Lighten3)
                                            .Padding(4)
                                            .Text($"{order.SequenceOrder}) {order.CustomerName.ToUpper()}").FontSize(18).ExtraBold();

                                        // ── REVERTED: back to plain raw remarks text, no dash
                                        // reformatting/column-alignment. Shows exactly what the
                                        // salesman typed (e.g. "ELAKKA-1KG", "ULLI -10KG"), only
                                        // uppercased, same as before that formatting was added. ──
                                        orderCol.Item().PaddingTop(4).PaddingLeft(5)
                                            .Text(order.Remarks.ToUpper()).FontSize(18).ExtraBold().FontColor(Colors.Black);
                                    });

                                    // FIX: separator line between each customer entry for readability —
                                    // was previously missing (customers were only separated by padding).
                                    if (order != route.Orders.Last())
                                    {
                                        routeCol.Item().PaddingTop(8).LineHorizontal(2.5f).LineColor(Colors.Black);
                                    }
                                }

                                if (route != routes.Last())
                                {
                                    routeCol.Item().PageBreak();
                                }
                            });
                        }
                    });

                    // ── Footer ──
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
                            x.Span($" | Generated: {DateTime.UtcNow:HH:mm:ss}");
                        });
                });
            }).GeneratePdf();
        }
        catch
        {
            return Array.Empty<byte>();
        }
    }

    private static byte[] GenerateEmptyRetailSheet(DateTime targetDate, string message)
    {
        try
        {
            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(0.5f, PdfUnit.Centimetre);
                    page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Liberation Serif"));

                    page.Header()
                        .BorderBottom(0.5f)
                        .PaddingBottom(5)
                        .Row(row =>
                        {
                            row.RelativeItem().Column(col =>
                            {
                                col.Item().Text("📝 RETAIL SHEET").FontSize(14).Bold();
                                col.Item().Text($"Date: {targetDate:dd-MM-yyyy}");
                            });
                            row.RelativeItem().AlignRight().Column(col =>
                            {
                                col.Item().Text($"Generated: {DateTime.UtcNow:dd-MM-yyyy HH:mm}");
                            });
                        });

                    page.Content()
                        .PaddingTop(40)
                        .AlignCenter()
                        .Column(col =>
                        {
                            col.Item().Text("⚠️ No Retail Items").FontSize(14).Bold().FontColor(Colors.Orange.Medium);
                            col.Item().Text(message).FontSize(10).FontColor(Colors.Grey.Medium);
                            col.Item().PaddingTop(20).Text("Possible reasons:").FontSize(9).FontColor(Colors.Grey.Medium);
                            col.Item().Text("• No orders with remarks-only (no products) were found for this route/date").FontSize(9).FontColor(Colors.Grey.Medium);
                            col.Item().Text("• Orders are still in Draft or Approved status").FontSize(9).FontColor(Colors.Grey.Medium);
                            col.Item().Text("• Admin must close orders before retail sheet generation").FontSize(9).FontColor(Colors.Grey.Medium);
                        });

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
        catch
        {
            return Array.Empty<byte>();
        }
    }
}