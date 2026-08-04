// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetBillingSheetQueryHandler.cs

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Reports.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using PdfUnit = QuestPDF.Infrastructure.Unit;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetBillingSheetQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetBillingSheetQuery, Result<byte[]>>
{
    // ── FALLBACK ONLY — mirrors GetLoadingSheetQueryHandler's fallback list exactly.
    // The real, editable priority now lives on SizeGroup.SortOrder in the database (set
    // via the Size Groups admin screen's up/down reorder controls). This static map only
    // kicks in if a size group somehow has no SortOrder recorded yet. ──
    private static readonly Dictionary<string, int> SizeGroupPriorityFallback = new(StringComparer.OrdinalIgnoreCase)
    {
        ["50 KG BAG"] = 1,
        ["30 KG BAG"] = 2,
        ["26 KG BAG"] = 3,
        ["20 KG BAG"] = 4,
        ["20 LTR CASE"] = 5,
        ["10 LTR CASE"] = 6,
        ["15 LTR TIN"] = 7,
        ["5 LTR CAN"] = 8,
    };

    public async Task<Result<byte[]>> Handle(GetBillingSheetQuery request, CancellationToken cancellationToken)
    {
        var targetDate = request.Date ?? DateTime.UtcNow.Date;

        // Query orders for the target date (submitted or closed, not draft)
        var ordersQuery = context.Orders
            .AsNoTracking()
        .Include(o => o.Customer)
        .Include(o => o.Route)
        .Include(o => o.Items!)
            .ThenInclude(i => i.Product!)
                .ThenInclude(p => p.SizeGroup)
        .Include(o => o.Items!)
            .ThenInclude(i => i.Unit)
        .Where(o => !o.IsDeleted
            && o.OrderDate.Date == targetDate.Date);   // Draft/Submitted/Closed all included

        if (request.RouteId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.RouteId == request.RouteId.Value);
        }

        var orders = await ordersQuery.ToListAsync(cancellationToken);

        if (orders.Count == 0)
        {
            return Result<byte[]>.Failure($"No orders found for date {targetDate:yyyy-MM-dd}.");
        }

        // ── NEW: load the admin-configurable size-group display order from the database
        // (same source the Loading Sheet uses), so both reports always agree. ──
        var sizeGroupPriorities = (await context.SizeGroups
                .Where(g => !g.IsDeleted)
                .Select(g => new { g.Name, g.SortOrder })
                .ToListAsync(cancellationToken))
            .ToDictionary(g => g.Name, g => g.SortOrder, StringComparer.OrdinalIgnoreCase);

        // Group by route
        var routeGroups = orders
            .GroupBy(o => new { o.RouteId, o.Route!.Name })
            .Select(g => new BillingSheetRouteGroupDto
            {
                RouteId = g.Key.RouteId,
                RouteName = g.Key.Name,
                Orders = g
                    .OrderBy(o => o.Customer?.SequenceOrder ?? 0)
                    // ── FIX: number stops by their position within THIS route's sorted list,
                    // not by the customer's raw (global) SequenceOrder field. The old code used
                    // o.Customer.SequenceOrder directly, which can have gaps/duplicates across
                    // customers (e.g. 3, 7, 12...). Using the loop index guarantees a clean,
                    // contiguous 1, 2, 3, 4, 5, 6... sequence per route, matching the loading sheet. ──
                    .Select((o, idx) => new BillingSheetOrderDto
                    {
                        OrderId = o.Id,
                        OrderNumber = o.OrderNumber,
                        CustomerName = o.Customer?.NameEnglish ?? string.Empty,
                        CustomerNameMalayalam = o.Customer?.NameMalayalam,
                        OrderDate = o.OrderDate,
                        SequenceOrder = idx,
                        Remarks = string.IsNullOrWhiteSpace(o.Remarks) ? null : o.Remarks,
                        // ── Items now ordered by the admin-configured size-group priority
                        // (see sizeGroupPriorities), then by name, instead of insertion order.
                        // Both the sort key and the displayed name/size-group prefer the
                        // snapshot taken at order-creation time over the live Product row,
                        // so this still reflects what was actually ordered even if the
                        // product's been renamed/regrouped since (including through a
                        // reopen + re-close cycle). Falls back to the live join for rows
                        // created before this snapshot field existed. ──
                        Items = o.Items!
                            .OrderBy(i => ResolveSizeGroupSortKey(i.SizeGroupNameAtTime ?? i.Product?.SizeGroup?.Name, sizeGroupPriorities))
                            .ThenBy(i => i.ProductNameAtTime ?? i.Product?.NameEnglish)
                            .Select(i => new BillingSheetItemDto
                            {
                                ProductName = i.ProductNameAtTime ?? i.Product?.NameEnglish ?? string.Empty,
                                ProductNameMalayalam = i.ProductNameMalayalamAtTime ?? i.Product?.NameMalayalam,
                                SizeGroupName = i.SizeGroupNameAtTime ?? i.Product?.SizeGroup?.Name,
                                UnitSymbol = i.Unit?.Symbol ?? string.Empty,
                                Quantity = i.Quantity,
                                SellingPrice = i.SellingPrice,
                                LineTotal = i.SellingPrice * i.Quantity,
                                BasePriceAtTime = i.BasePriceAtTime,
                                Variance = (i.SellingPrice - i.BasePriceAtTime) * i.Quantity
                            }).ToList(),
                        OrderTotal = o.Items!.Sum(i => i.SellingPrice * i.Quantity),
                        OrderVariance = o.Items!.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity)
                    }).ToList(),
                RouteTotalSales = g.SelectMany(o => o.Items!).Sum(i => i.SellingPrice * i.Quantity),
                RouteTotalVariance = g.SelectMany(o => o.Items!).Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity)
            })
            .OrderBy(r => r.RouteName)
            .ToList();

        var data = new BillingSheetDataDto
        {
            ReportDate = targetDate,
            GeneratedAt = DateTime.UtcNow,
            Routes = routeGroups,
            GrandTotalSales = routeGroups.Sum(r => r.RouteTotalSales),
            GrandTotalVariance = routeGroups.Sum(r => r.RouteTotalVariance),
            TotalOrders = orders.Count,
            TotalRoutes = routeGroups.Count
        };

        // Generate PDF
        var pdfBytes = GenerateBillingSheetPdf(data);

        return Result<byte[]>.Success(pdfBytes);
    }

    // ── Size Group Prioritization: the admin-configurable DB value (SizeGroup.SortOrder,
    // set from the Size Groups screen's up/down reorder controls) is now the primary
    // source of truth. Falls back to the client's originally hand-written priority list
    // only if a group has no SortOrder recorded (-1 / missing), and finally to parsing
    // the leading number out of the name ("25 KG" → 25) so any still-unmapped group at
    // least sorts in a sensible heaviest-first order, placed after every group that does
    // have a priority. Mirrors the Loading Sheet's logic exactly. ──
    private static int ResolveSizeGroupSortKey(string? sizeGroupName, IReadOnlyDictionary<string, int> sizeGroupPriorities)
    {
        if (string.IsNullOrWhiteSpace(sizeGroupName)) return int.MaxValue;

        var key = sizeGroupName.Trim();

        if (sizeGroupPriorities.TryGetValue(key, out var dbPriority) && dbPriority >= 0)
        {
            return dbPriority;
        }

        if (SizeGroupPriorityFallback.TryGetValue(key, out var mappedPriority))
        {
            return mappedPriority;
        }

        var match = Regex.Match(sizeGroupName, @"\d+");
        if (match.Success && int.TryParse(match.Value, out var kg))
        {
            // Offset well above the mapped range (1-8, or whatever admins have configured)
            // so unassigned groups always sort after every assigned one.
            return 100000 - kg;
        }
        return int.MaxValue;
    }

    // ── Fixes the "(5" / "Liter)" split some long product names were showing when they
    // wrapped to a second line — the PDF renderer breaks on any space, including the one
    // between "5" and "Liter" inside "(5 Liter)". Replacing spaces *inside* parentheses with
    // a non-breaking space (U+00A0) stops the renderer from splitting there, so the whole
    // "(5 Liter)" moves to the next line together if it doesn't fit, instead of tearing the
    // bracket apart across two lines. The space before "(" is left alone, so wrapping can
    // still happen there normally (name on one line, bracket on the next, as one unit). ──
    private static string KeepParentheticalTogether(string productName)
        => Regex.Replace(productName, @"\(([^)]*)\)", m => "(" + m.Groups[1].Value.Replace(' ', '\u00A0') + ")");

    // ── PDF Generator: matching the Loading Sheet style with 3 columns (Product, Qty, Price) ──
    private static byte[] GenerateBillingSheetPdf(BillingSheetDataDto data)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0.5f, PdfUnit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Liberation Serif"));

                // Header
                page.Header()
                    .BorderBottom(0.5f)
                    .PaddingBottom(5)
                    .Column(col =>
                    {
                        col.Item().Text("BILLING SHEET").FontSize(16).Bold();
                        col.Item().Text($"Date: {data.ReportDate:dd-MM-yyyy}").FontSize(10);
                    });

                // Content
                page.Content().Column(contentCol =>
                {
                    foreach (var route in data.Routes)
                    {
                        contentCol.Item().PaddingTop(10).Column(routeCol =>
                        {
                            // Route header - centered like loading sheet
                            routeCol.Item().Background(Colors.Grey.Lighten2)
                                .Padding(6)
                                .AlignCenter()
                                .Text($"{route.RouteName.ToUpper()}").FontSize(18).Bold();

                            // ── One block per customer stop ──
                            foreach (var order in route.Orders)
                            {
                                // FIX: ShowEntire() removed here — same reasoning as the Loading Sheet's
                                // identical block. A stop with many items plus the retail-items
                                // divider/label/remarks can exceed a single page's height, and
                                // ShowEntire() hard-fails the whole PDF instead of splitting in that
                                // case. Letting it paginate normally avoids the entire report failing
                                // for routes with genuinely large orders.
                                routeCol.Item().PaddingTop(8).Column(stopCol =>
                                {
                                    // Customer header with number and name centered
                                    // order.SequenceOrder is now a contiguous, per-route index (see Handle() above),
                                    // so "+ 1" always produces 1, 2, 3, 4, 5, 6... in delivery order.
                                    // ── This row now shares the exact same AlignCenter().Width(480) box as the
                                    // product table below it, so their left edges line up precisely. The number
                                    // sits at the very left of that box with the same PaddingLeft(5) the table's
                                    // PRODUCT header uses — meaning it lands directly above the "P" of PRODUCT,
                                    // rather than floating at some independent position further inward like before,
                                    // since the number previously lived in a full-width row unrelated to the
                                    // table's actual left edge. ──
                                    stopCol.Item().Background(Colors.Grey.Lighten3)
                                        .Padding(4)
                                        .AlignCenter().Width(480)
                                        .Row(r =>
                                        {
                                            r.ConstantItem(40).PaddingLeft(5).Text($"{order.SequenceOrder + 1})").FontSize(18).ExtraBold();
                                            r.RelativeItem().AlignCenter().Text(order.CustomerName.ToUpper()).FontSize(18).ExtraBold();
                                            r.ConstantItem(40);
                                        });

                                    if (order.Items.Count > 0)
                                    {
                                        // ── Widened from 420→480 and rebalanced column shares (was a flat
                                        // 40/20/40 split, which gave PRODUCT only ~168pt — much narrower than
                                        // the Loading Sheet's equivalent column — causing long names to wrap
                                        // awkwardly mid-bracket, e.g. "Milma Ghee ( 5" / "Liter)". PRODUCT now
                                        // gets ~55% (≈262pt, in line with the Loading Sheet), and QTY/PRICE
                                        // cells get added horizontal padding so there's real visible space
                                        // between the three columns instead of them sitting edge-to-edge. ──
                                        stopCol.Item().AlignCenter().Width(480).PaddingTop(4).Table(table =>
                                        {
                                            // Three columns: Product (~55%), Qty (~18%), Price (~27%)
                                            table.ColumnsDefinition(columns =>
                                            {
                                                columns.RelativeColumn(6);  // Product
                                                columns.RelativeColumn(2);  // Qty
                                                columns.RelativeColumn(3);  // Price
                                            });

                                            table.Header(header =>
                                            {
                                                header.Cell().BorderBottom(1)
                                                    .PaddingVertical(4)
                                                    .PaddingLeft(5)
                                                    .PaddingRight(10)
                                                    .Text("PRODUCT")
                                                    .Bold()
                                                    .FontSize(18);

                                                header.Cell().BorderBottom(1)
                                                    .PaddingVertical(4)
                                                    .PaddingHorizontal(8)
                                                    .AlignCenter()
                                                    .Text("QTY")
                                                    .Bold()
                                                    .FontSize(18);

                                                header.Cell().BorderBottom(1)
                                                    .PaddingVertical(4)
                                                    .PaddingLeft(8)
                                                    .PaddingRight(5)
                                                    .AlignRight()
                                                    .Text("PRICE")
                                                    .Bold()
                                                    .FontSize(18);
                                            });

                                            foreach (var item in order.Items)
                                            {
                                                // Product name - left aligned, extra bold and larger for readability
                                                table.Cell().BorderBottom(0.5f)
                                                    .PaddingVertical(3)
                                                    .PaddingLeft(5)
                                                    .PaddingRight(10)
                                                    .Text(KeepParentheticalTogether(item.ProductName.ToUpper()))
                                                    .FontSize(18)
                                                    .ExtraBold();

                                                // Quantity - centered, extra bold and larger for readability
                                                table.Cell().BorderBottom(0.5f)
                                                    .PaddingVertical(3)
                                                    .PaddingHorizontal(8)
                                                    .AlignCenter()
                                                    .Text($"{item.Quantity:N0} {item.UnitSymbol}")
                                                    .FontSize(18)
                                                    .ExtraBold();

                                                // Price - right aligned, extra bold and larger for readability
                                                table.Cell().BorderBottom(0.5f)
                                                    .PaddingVertical(3)
                                                    .PaddingLeft(8)
                                                    .PaddingRight(5)
                                                    .AlignRight()
                                                    .Text($"₹{item.SellingPrice:N2}")
                                                    .FontSize(18)
                                                    .ExtraBold();
                                            }
                                        });
                                    }
                                    else if (order.Remarks == null)
                                    {
                                        stopCol.Item().AlignCenter().Width(480).PaddingLeft(5).Padding(3).Text("—").FontSize(10);
                                    }

                                    // ── Remarks - plain black text, no background shade ──
                                    // Extra bold + 18pt for stronger readability, matching the product/qty/price rows.
                                    // Wrapped with the same AlignCenter().Width(480) + PaddingLeft(5) as the table
                                    // above so remarks line up directly under the PRODUCT column.
                                    //
                                    // FIX: nested a second ShowEntire() around just this block, same reasoning as
                                    // GetLoadingSheetQueryHandler — the outer ShowEntire() around the whole stop
                                    // wasn't reliably keeping the retail-items tail together when a page boundary
                                    // fell in the middle of it.
                                    if (order.Remarks != null)
                                    {
                                        stopCol.Item().ShowEntire().Column(remarksCol =>
                                        {
                                            // Using a full-width line with padding to make it visually distinct
                                            remarksCol.Item().AlignCenter().Width(520).PaddingTop(6).PaddingBottom(4)
                                                .LineHorizontal(2.5f);  // Thicker than default (2.5pt)
                                            // ── RETAIL ITEMS LABEL ──
                                            remarksCol.Item().AlignCenter().Width(520).PaddingLeft(5).PaddingTop(2)
                                                .Text("RETAIL ITEMS:").FontSize(14).ExtraBold().FontColor(Colors.Grey.Darken2);
                                            // Extra bold + 18pt for stronger readability, matching the product/qty rows.
                                            remarksCol.Item().AlignCenter().Width(520).PaddingLeft(5).PaddingTop(4)
                                                .Text(order.Remarks.ToUpper()).FontSize(18).ExtraBold().FontColor(Colors.Black);
                                        });
                                    }
                                });
                            }

                            if (route != data.Routes.Last())
                            {
                                routeCol.Item().PageBreak();
                            }
                        });
                    }
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
                        x.Span($"  |  Generated: {data.GeneratedAt:HH:mm:ss}");
                    });
            });
        }).GeneratePdf();
    }
}