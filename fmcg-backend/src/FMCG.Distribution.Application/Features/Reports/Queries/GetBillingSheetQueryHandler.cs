// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetBillingSheetQueryHandler.cs

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
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

        // FIX: was including Draft/Submitted orders alongside Closed ones (the old inline
        // comment even said so — "Draft/Submitted/Closed all included" — despite the doc
        // comment above the query claiming otherwise). That let un-finalized orders onto a
        // customer-facing billing sheet, and let duplicate Draft orders for the same stop
        // (e.g. a double-submit) print as two separate numbered entries. Now matches
        // GetLoadingSheetQueryHandler's rule exactly: only Closed or Locked orders count.
        var ordersQuery = context.Orders
            .AsNoTracking()
        .Include(o => o.Customer)
        .Include(o => o.Route)
        .Include(o => o.Items!)
            .ThenInclude(i => i.Product!)
                .ThenInclude(p => p.SizeGroup)
        .Include(o => o.Items!)
            .ThenInclude(i => i.Product!)
                .ThenInclude(p => p.ProductGroup)
        .Include(o => o.Items!)
            .ThenInclude(i => i.Unit)
        .Where(o => !o.IsDeleted
            && (o.Status == OrderStatus.Closed || o.IsLocked)
            && o.OrderDate.Date == targetDate.Date);

        if (request.RouteId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.RouteId == request.RouteId.Value);
        }

        var orders = await ordersQuery.ToListAsync(cancellationToken);

        if (orders.Count == 0)
        {
            return Result<byte[]>.Failure(
                request.RouteId.HasValue
                    ? $"No closed orders found for the selected route/date ({targetDate:yyyy-MM-dd})."
                    : $"No closed orders found for date {targetDate:yyyy-MM-dd}.");
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
            .Select(g =>
            {
                // ── FIX: group by CUSTOMER, not by individual order. A customer with
                // more than one Closed/Locked order on the same date (e.g. a
                // duplicate/double-submit, or a genuinely second order taken later the
                // same day) previously showed up as two separate numbered stops with the
                // same shop name — e.g. "EMPIRE SUPERMARKET, OLAKKETYAMBALAM" appearing
                // as both #10 and #11 with the same items. Grouping by customer first,
                // then merging every one of that customer's orders together into one
                // entry (summing quantity for matching products instead of listing them
                // twice), gives each shop exactly one entry per day — same fix already
                // applied to the Retail Sheet's identical duplicate-customer bug. ──
                var mergedOrders = g
                    .GroupBy(o => o.CustomerId)
                    // ── FIX: number stops by their position within THIS route's sorted list,
                    // not by the customer's raw (global) SequenceOrder field. The old code used
                    // o.Customer.SequenceOrder directly, which can have gaps/duplicates across
                    // customers (e.g. 3, 7, 12...). Using the loop index guarantees a clean,
                    // contiguous 1, 2, 3, 4, 5, 6... sequence per route, matching the loading sheet. ──
                    .OrderBy(cg => cg.First().Customer?.SequenceOrder ?? 0)
                    .Select((cg, idx) =>
                    {
                        var customer = cg.First().Customer;
                        var combinedRemarks = string.Join("\n", cg
                            .Select(o => o.Remarks)
                            .Where(r => !string.IsNullOrWhiteSpace(r)));

                        // ── Merge items across every one of this customer's orders. A line
                        // is considered "the same" if it's the same product, same size
                        // group, same selling price, and same base price — matching lines
                        // have their quantities summed into ONE row instead of printing as
                        // duplicate rows. A genuinely different selling price for the same
                        // product across two separate orders (rare, but possible) still
                        // prints as its own line, since silently combining those would hide
                        // a real pricing difference rather than a duplicate-order artifact.
                        // Sort key, name, and size-group prefer the snapshot taken at
                        // order-creation time over the live Product row, same as before. ──
                        var mergedItems = cg
                            .Where(o => o.Items != null)
                            .SelectMany(o => o.Items!)
                            .GroupBy(i => new
                            {
                                ProductName = i.ProductNameAtTime ?? i.Product?.NameEnglish,
                                SizeGroupName = i.SizeGroupNameAtTime ?? i.Product?.SizeGroup?.Name,
                                i.SellingPrice,
                                i.BasePriceAtTime,
                                UnitSymbol = i.Unit?.Symbol,
                                ProductNameMalayalam = i.ProductNameMalayalamAtTime ?? i.Product?.NameMalayalam,
                                ProductGroupName = i.Product != null && i.Product.ProductGroup != null
                                    ? i.Product.ProductGroup.Name
                                    : null,
                            })
                            .Select(ig => new BillingSheetItemDto
                            {
                                ProductName = ig.Key.ProductName ?? string.Empty,
                                ProductNameMalayalam = ig.Key.ProductNameMalayalam,
                                SizeGroupName = ig.Key.SizeGroupName,
                                ProductGroupName = ig.Key.ProductGroupName,
                                UnitSymbol = ig.Key.UnitSymbol ?? string.Empty,
                                Quantity = ig.Sum(i => i.Quantity),
                                SellingPrice = ig.Key.SellingPrice,
                                LineTotal = ig.Key.SellingPrice * ig.Sum(i => i.Quantity),
                                BasePriceAtTime = ig.Key.BasePriceAtTime,
                                Variance = (ig.Key.SellingPrice - ig.Key.BasePriceAtTime) * ig.Sum(i => i.Quantity),
                            })
                            .OrderBy(i => ResolveSizeGroupSortKey(i.SizeGroupName, sizeGroupPriorities))
                            .ThenBy(i => i.ProductName)
                            .ToList();

                        return new BillingSheetOrderDto
                        {
                            OrderId = cg.First().Id,
                            OrderNumber = cg.First().OrderNumber,
                            CustomerName = customer?.NameEnglish ?? string.Empty,
                            CustomerNameMalayalam = customer?.NameMalayalam,
                            OrderDate = cg.First().OrderDate,
                            SequenceOrder = idx,
                            Remarks = string.IsNullOrWhiteSpace(combinedRemarks) ? null : combinedRemarks,
                            Items = mergedItems,
                            OrderTotal = mergedItems.Sum(i => i.LineTotal),
                            OrderVariance = mergedItems.Sum(i => i.Variance),
                        };
                    })
                    .ToList();

                return new BillingSheetRouteGroupDto
                {
                    RouteId = g.Key.RouteId,
                    RouteName = g.Key.Name,
                    Orders = mergedOrders,
                    // ── FIX: totals now computed from the MERGED per-customer orders
                    // (mergedOrders), not from the raw un-merged order list — otherwise a
                    // duplicate order's items would still be double-counted in the route
                    // total even after the display-level merge above, giving a route total
                    // that doesn't match what's actually printed on the sheet. ──
                    RouteTotalSales = mergedOrders.Sum(o => o.OrderTotal),
                    RouteTotalVariance = mergedOrders.Sum(o => o.OrderVariance),
                };
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

    // ── NEW: flags products in the VEGETABLES and CHILLES item groups so they can be
    // marked with an "X" on the printed sheet — same rule as the Loading Sheet, purely
    // a visual flag for staff. ──
    private static readonly HashSet<string> FlaggedProductGroups =
        new(StringComparer.OrdinalIgnoreCase) { "VEGETABLES", "CHILLES" };

    private static bool IsFlaggedProductGroup(string? productGroupName)
        => productGroupName != null && FlaggedProductGroups.Contains(productGroupName.Trim());

    // ── NEW: pulls the leading number out of a size-group name (e.g. "50 KG
    // BAG" → 50, "10 LTR" → 10), used to sort the Size Group Summary from
    // largest to smallest rather than alphabetically (which would put "10
    // LTR" before "50 KG BAG"). Falls back to 0 for anything unparsable, so
    // it sorts last rather than throwing. ──
    private static int ExtractLeadingNumber(string sizeGroupName)
    {
        var match = System.Text.RegularExpressions.Regex.Match(sizeGroupName, @"\d+");
        return match.Success && int.TryParse(match.Value, out var n) ? n : 0;
    }

    // ── Matches a size-group name against a specific weight (e.g. "50 KG BAG"
    // matches 50) — needed to combine 50/30/26kg into one equivalent total in
    // the Size Group Summary, same helper used for this purpose elsewhere. ──
    private static bool MatchesSizeGroupWeight(string? sizeGroupName, int kg)
        => sizeGroupName != null && Regex.IsMatch(sizeGroupName, $@"\b{kg}\s*kg\b", RegexOptions.IgnoreCase);

    // ── FIX: unit label is now derived from the actual unit word already present in
    // the size group's own name (BAG / BOX / CASE / TIN / CAN), instead of guessing
    // from whether the name contains "KG" vs "LTR" and defaulting everything else to
    // "BAGS". That guess was wrong for any group that wasn't literally "X KG BAG" or
    // "X LTR TIN" — e.g. "15 KG BOX" printed as BAGS, and "10 LTR CASE" / "20 LTR
    // CASE" printed as TINS, even though both size groups already spell out their
    // real unit right in the name. Checking for each real unit word directly means
    // any size group — present now, or added later in the Size Groups master — gets
    // its own correct label automatically, with no per-group mapping to maintain.
    // Order doesn't matter here: none of BAG/BOX/CASE/TIN/CAN is a substring of any
    // of the others, so there's no ambiguity between checks. ──
    private static string ResolveSizeGroupUnitLabel(string sizeGroupName)
    {
        if (sizeGroupName.Contains("CASE", StringComparison.OrdinalIgnoreCase)) return "CASE";
        if (sizeGroupName.Contains("BOX", StringComparison.OrdinalIgnoreCase)) return "BOX";
        if (sizeGroupName.Contains("CAN", StringComparison.OrdinalIgnoreCase)) return "CANS";
        if (sizeGroupName.Contains("TIN", StringComparison.OrdinalIgnoreCase)) return "TINS";
        if (sizeGroupName.Contains("BAG", StringComparison.OrdinalIgnoreCase)) return "BAGS";
        // Fallback for any size group whose name doesn't spell out one of the known
        // unit words above — shouldn't happen with real data, but better to show
        // something explicit than silently mislabel it as one of the others.
        return "UNITS";
    }

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
                                // FIX: EnsureSpace() instead of a plain Column() — reserves a minimum
                                // block of space so this stop's header row can't get stranded alone at
                                // the very bottom of a page with its item table starting fresh on the
                                // next one. Unlike ShowEntire() (removed above for the same block), this
                                // doesn't require the ENTIRE stop to fit before starting it — a genuinely
                                // huge table can still paginate normally after the reserved minimum, so
                                // this can't reintroduce the "conflicting size constraints" crash.
                                routeCol.Item().PaddingTop(8).EnsureSpace().Column(stopCol =>
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
                                                // ── FIX: X marker rendered as its own larger, bolder text span
                                                // within the same cell — was previously plain text at the same
                                                // size/weight as the product name, which read as too thin. Kept
                                                // inline (no new column, no layout change) but visibly heavier
                                                // and bigger, since it's now its own span with a bigger font size.
                                                var isFlagged = IsFlaggedProductGroup(item.ProductGroupName);
                                                var productNameText = KeepParentheticalTogether(item.ProductName.ToUpper());

                                                // Product name - left aligned, extra bold and larger for readability
                                                // FIX: separator line made bolder (was 0.5f) per request.
                                                table.Cell().BorderBottom(1.5f)
                                                    .PaddingVertical(3)
                                                    .PaddingLeft(5)
                                                    .PaddingRight(10)
                                                    .Text(text =>
                                                    {
                                                        text.Span(productNameText).FontSize(18).ExtraBold();
                                                        if (isFlagged)
                                                        {
                                                            text.Span("  X").FontSize(26).ExtraBold().FontColor(Colors.Black);
                                                        }
                                                    });

                                                // Quantity - centered, extra bold and larger for readability
                                                // FIX: separator line made bolder (was 0.5f) per request.
                                                table.Cell().BorderBottom(1.5f)
                                                    .PaddingVertical(3)
                                                    .PaddingHorizontal(8)
                                                    .AlignCenter()
                                                    .Text($"{item.Quantity:N0} {item.UnitSymbol}")
                                                    .FontSize(18)
                                                    .ExtraBold();

                                                // Price - right aligned, extra bold and larger for readability
                                                // FIX: separator line made bolder (was 0.5f) per request.
                                                table.Cell().BorderBottom(1.5f)
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
                                    // FIX: ShowEntire() replaced with EnsureSpace() — same bug and same fix as
                                    // GetLoadingSheetQueryHandler's remarks block. ShowEntire() requires this
                                    // block to fit entirely within one blank page; a long Remarks string on a
                                    // large order can exceed that, which throws the hard "conflicting size
                                    // constraints" exception and fails the whole report (surfaces to the browser
                                    // as a raw 500 / CORS error, since nothing in this handler catches it).
                                    // EnsureSpace() still keeps the divider/label glued to the start of the
                                    // remarks text without requiring the whole block to fit in one page.
                                    if (order.Remarks != null)
                                    {
                                        stopCol.Item().EnsureSpace().Column(remarksCol =>
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

                    // ── UPDATED: Size Group Summary — billing sheet ONLY. 50KG, 30KG, and
                    // 26KG groups are now combined into a single equivalent-total line
                    // (same 1.0 / 0.5 / 0.5 weighting used everywhere else in this app —
                    // Loading Sheet threshold alerts, salesman bag tracker), since these
                    // three specifically represent interchangeable loading capacity. Every
                    // OTHER size group (25kg, 20kg, 10ltr, 5ltr, etc.) still gets its own
                    // individual line with a plain raw count, unchanged from before. ──
                    var allSummaryItems = data.Routes
                        .SelectMany(r => r.Orders)
                        .SelectMany(o => o.Items)
                        .Where(i => !string.IsNullOrWhiteSpace(i.SizeGroupName))
                        .ToList();

                    var weightedItems = allSummaryItems
                        .Where(i => MatchesSizeGroupWeight(i.SizeGroupName, 50)
                            || MatchesSizeGroupWeight(i.SizeGroupName, 30)
                            || MatchesSizeGroupWeight(i.SizeGroupName, 26))
                        .ToList();

                    var combinedEquivalentTotal = weightedItems.Sum(i =>
                        MatchesSizeGroupWeight(i.SizeGroupName, 50) ? i.Quantity : i.Quantity * 0.5m);

                    var individualGroupCounts = allSummaryItems
                        .Except(weightedItems)
                        .GroupBy(i => i.SizeGroupName!.Trim(), StringComparer.OrdinalIgnoreCase)
                        .Select(g => new { SizeGroupName = g.Key, TotalQuantity = g.Sum(i => i.Quantity) })
                        .OrderByDescending(g => ExtractLeadingNumber(g.SizeGroupName))
                        .ToList();

                    if (weightedItems.Count > 0 || individualGroupCounts.Count > 0)
                    {
                        contentCol.Item().PaddingTop(14).EnsureSpace().Column(summaryCol =>
                        {
                            // FIX: font size increased to 18 (was 16), per updated request.
                            summaryCol.Item().Background(Colors.Grey.Lighten3).Padding(8)
                                .Text("📦 SIZE GROUP SUMMARY").FontSize(18).Bold();

                            if (weightedItems.Count > 0)
                            {
                                // FIX: font size increased to 18 (was 13), per updated request.
                                summaryCol.Item().PaddingTop(3).PaddingLeft(8)
                                    .Text($"50KG + 30KG + 26KG (EQUIVALENT) — {combinedEquivalentTotal:0.#} BAGS")
                                    .FontSize(18).Bold();
                            }

                            foreach (var g in individualGroupCounts)
                            {
                                // FIX: unit label now resolved from the actual unit word in the
                                // size group's name (BAG/BOX/CASE/TIN/CAN) via
                                // ResolveSizeGroupUnitLabel — was previously guessed from
                                // KG-vs-LTR alone, which mislabeled BOX and CASE groups.
                                var unitLabel = ResolveSizeGroupUnitLabel(g.SizeGroupName);

                                // FIX: font size increased to 18 (was 13), per updated request.
                                summaryCol.Item().PaddingTop(3).PaddingLeft(8)
                                    .Text($"{g.SizeGroupName.ToUpper()} — {g.TotalQuantity:N0} {unitLabel}")
                                    .FontSize(18).Bold();
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