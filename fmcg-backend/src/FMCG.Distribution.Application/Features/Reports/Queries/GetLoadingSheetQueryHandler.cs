// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetLoadingSheetQueryHandler.cs

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

public class GetLoadingSheetQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetLoadingSheetQuery, Result<byte[]>>
{
    // Loading workers get a highlighted alert once a route's weighted bag count reaches this.
    // FIX: threshold changed from 130 to 125, per updated request.
    private const int BagLoadingThreshold = 125;

    // ── FALLBACK ONLY: the client's originally hand-written "Size Group Priority" list.
    // The real, editable priority now lives on SizeGroup.SortOrder in the database (set
    // via the Size Groups admin screen's up/down reorder controls, backed by
    // PUT /api/v1/sizegroups/{id}/priority). This static map only kicks in if a size
    // group somehow has no SortOrder recorded yet (e.g. data created outside the normal
    // flow) — it is NOT the primary source of truth anymore. ──
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

    public async Task<Result<byte[]>> Handle(GetLoadingSheetQuery request, CancellationToken cancellationToken)
    {
        try
        {
            var targetDate = request.Date?.Date ?? DateTime.UtcNow.Date;

            // ── Get all orders with Closed status for the target date ──
            var closedOrdersQuery = context.Orders
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
                closedOrdersQuery = closedOrdersQuery.Where(o => o.RouteId == request.RouteId.Value);
            }

            var closedOrders = await closedOrdersQuery.ToListAsync(cancellationToken);

            if (closedOrders.Count == 0)
            {
                var emptyPdf = GenerateEmptyLoadingSheet(
                    targetDate,
                    request.RouteId.HasValue ? "No closed orders found for the selected route/date." : "No closed orders found for this date."
                );
                return Result<byte[]>.Success(emptyPdf);
            }

            // ── Get unit priorities ──
            var units = await context.ProductUnits
                .AsNoTracking()
                .Where(u => !u.IsDeleted)
                .ToDictionaryAsync(u => u.Id, u => u.LoadingPriority, cancellationToken);

            // ── NEW: load the admin-configurable size-group display order from the
            // database. This is what the Size Groups admin screen's up/down reorder
            // controls actually change — no code change needed to add a new size group
            // or move one earlier/later in the reports. ──
            var sizeGroupPriorities = (await context.SizeGroups
                    .Where(g => !g.IsDeleted)
                    .Select(g => new { g.Name, g.SortOrder })
                    .ToListAsync(cancellationToken))
                .ToDictionary(g => g.Name, g => g.SortOrder, StringComparer.OrdinalIgnoreCase);

            // ── Group orders by route ──
            var routeGroups = closedOrders
                .Where(o => o.Route != null)
                .GroupBy(o => new { o.RouteId, RouteName = o.Route?.Name ?? "Unknown" })
                .OrderBy(g => g.Key.RouteName)
                .ToList();

            var routeSummaries = new List<LoadingSheetRouteSummaryDto>();

            foreach (var routeGroup in routeGroups)
            {
                var routeOrders = routeGroup.ToList();

                // ── Build item summary for this route (kept for API back-compat; not shown in the new PDF layout) ──
                var itemSummaryDict = new Dictionary<string, LoadingSheetItemSummaryDto>();

                // ── Build size-group summary for this route (e.g. "50 KG - 250 Bags"), heaviest first ──
                var sizeGroupSummaryDict = new Dictionary<string, LoadingSheetSizeGroupSummaryDto>();

                foreach (var order in routeOrders)
                {
                    if (order.Items == null) continue;

                    foreach (var item in order.Items)
                    {
                        if (item.Product == null) continue;

                        var key = item.ProductId.ToString();
                        var unitName = item.Unit?.Name ?? string.Empty;

                        if (!itemSummaryDict.TryGetValue(key, out var existingSummary))
                        {
                            existingSummary = new LoadingSheetItemSummaryDto
                            {
                                // ── Prefer the name snapshot taken at order-creation time over the
                                // live Product row, so this still reflects what was actually ordered
                                // even if the product's been renamed since (including through a
                                // reopen + re-close cycle). Falls back to the live name for old rows
                                // created before this snapshot field existed. ──
                                ProductName = item.ProductNameAtTime ?? item.Product.NameEnglish,
                                ProductNameMalayalam = item.ProductNameMalayalamAtTime ?? item.Product.NameMalayalam,
                                UnitSymbol = item.Unit?.Symbol ?? string.Empty,
                                UnitTypeLabel = GetUnitTypeLabel(unitName),
                                LoadingPriority = units.GetValueOrDefault(item.UnitId, 99),
                                TotalQuantity = 0,
                                TotalBags = 0,
                                TotalBoxes = 0,
                                TotalTins = 0
                            };
                            itemSummaryDict[key] = existingSummary;
                        }

                        existingSummary.TotalQuantity += item.Quantity;

                        // ── Size-group rollup — same snapshot-first preference as above ──
                        var sizeGroupName = item.SizeGroupNameAtTime ?? item.Product.SizeGroup?.Name;
                        if (!string.IsNullOrWhiteSpace(sizeGroupName))
                        {
                            if (!sizeGroupSummaryDict.TryGetValue(sizeGroupName, out var sgSummary))
                            {
                                sgSummary = new LoadingSheetSizeGroupSummaryDto
                                {
                                    SizeGroupName = sizeGroupName,
                                    SortKey = ResolveSizeGroupSortKey(sizeGroupName, sizeGroupPriorities),
                                    // ── Derives the container word (BAGS/CASES/TINS/CANS) from the
                                    // size-group's own name, not from whichever product's Unit.Name
                                    // happened to be scanned first for this group — keeps bags=bags,
                                    // cans=cans consistent regardless of individual product unit setup. ──
                                    UnitTypeLabel = GetUnitTypeLabelFromSizeGroupName(sizeGroupName),
                                    TotalQuantity = 0
                                };
                                sizeGroupSummaryDict[sizeGroupName] = sgSummary;
                            }
                            sgSummary.TotalQuantity += item.Quantity;
                        }
                    }
                }

                // ── Build customer stops (in admin-assigned delivery sequence) ──
                var stops = new List<LoadingSheetStopDto>();
                var routeTotalQty = 0m;

                var orderedOrders = routeOrders
                    .OrderBy(o => o.Customer?.SequenceOrder ?? 0)
                    .ToList();

                int stopNumber = 1;
                var runningFiftyKgBags = 0;
                var runningThirtyKgBags = 0;
                var runningTwentySixKgBags = 0;
                var runningTwentyKgBags = 0;
                // ── NEW: the actual threshold-tracked total — 50kg bags at full weight,
                // 30kg/26kg bags at half weight each (see below). Decimal because half-weights
                // accumulate in 0.5 steps. ──
                var runningWeightedBags = 0m;
                var announcedMilestoneCount = 0;

                foreach (var order in orderedOrders)
                {
                    if (order.Customer == null || order.Items == null) continue;

                    var groupedItems = order.Items
                        .Where(i => i.Product != null)
                        .GroupBy(i => new
                        {
                            i.ProductId,
                            // ── Snapshot-first: shows what was actually on the order that day,
                            // not whatever the product happens to be named/grouped as right now. ──
                            ProductName = i.ProductNameAtTime ?? i.Product!.NameEnglish,
                            ProductNameMl = i.ProductNameMalayalamAtTime ?? i.Product.NameMalayalam,
                            i.UnitId,
                            UnitSymbol = i.Unit?.Symbol ?? string.Empty,
                            SizeGroupName = i.SizeGroupNameAtTime ?? i.Product.SizeGroup?.Name,
                            // ── NEW: Item Group name (VEGETABLES/CHILLES etc.) — not snapshotted like
                            // price/name are, since group membership isn't expected to change day-to-day
                            // and doesn't affect anything already printed on past sheets. ──
                            ProductGroupName = i.Product.ProductGroup != null ? i.Product.ProductGroup.Name : null,
                        })
                        .Select(g => new LoadingSheetItemDto
                        {
                            ProductName = g.Key.ProductName,
                            ProductNameMalayalam = g.Key.ProductNameMl,
                            UnitSymbol = g.Key.UnitSymbol,
                            TotalQuantity = g.Sum(i => i.Quantity),
                            LoadingPriority = units.GetValueOrDefault(g.Key.UnitId, 99),
                            UnitTypeLabel = GetUnitTypeLabel(g.Key.UnitSymbol),
                            SizeGroupName = g.Key.SizeGroupName,
                            SizeGroupSortKey = ResolveSizeGroupSortKey(g.Key.SizeGroupName, sizeGroupPriorities),
                            ProductGroupName = g.Key.ProductGroupName,
                            QuantityBags = 0,
                            QuantityBoxes = 0,
                            QuantityTins = 0,
                        })
                        // ── Size Group Prioritization: admin-configured DB order first, then
                        // loading priority, then name ──
                        .OrderBy(i => i.SizeGroupSortKey)
                        .ThenBy(i => i.LoadingPriority)
                        .ThenBy(i => i.ProductName)
                        .ToList();

                    var stopTotal = groupedItems.Sum(i => i.TotalQuantity);
                    routeTotalQty += stopTotal;

                    // ── 50kg bag threshold tracking — snapshot-first, same reasoning as above ──
                    var fiftyKgBagsThisStop = order.Items
                        .Where(i => MatchesSizeGroupWeight(i.SizeGroupNameAtTime ?? i.Product?.SizeGroup?.Name, 50))
                        .Sum(i => i.QuantityBags ?? (int)i.Quantity);
                    runningFiftyKgBags += fiftyKgBagsThisStop;

                    // ── Running totals for 30kg / 26kg / 20kg bags — still tracked and shown
                    // alongside the alert for the loader's situational awareness. ──
                    var thirtyKgBagsThisStop = order.Items
                        .Where(i => MatchesSizeGroupWeight(i.SizeGroupNameAtTime ?? i.Product?.SizeGroup?.Name, 30))
                        .Sum(i => i.QuantityBags ?? (int)i.Quantity);
                    runningThirtyKgBags += thirtyKgBagsThisStop;

                    var twentySixKgBagsThisStop = order.Items
                        .Where(i => MatchesSizeGroupWeight(i.SizeGroupNameAtTime ?? i.Product?.SizeGroup?.Name, 26))
                        .Sum(i => i.QuantityBags ?? (int)i.Quantity);
                    runningTwentySixKgBags += twentySixKgBagsThisStop;

                    var twentyKgBagsThisStop = order.Items
                        .Where(i => MatchesSizeGroupWeight(i.SizeGroupNameAtTime ?? i.Product?.SizeGroup?.Name, 20))
                        .Sum(i => i.QuantityBags ?? (int)i.Quantity);
                    runningTwentyKgBags += twentyKgBagsThisStop;

                    // ── FIX: the threshold now weighs bag sizes instead of only counting literal
                    // 50kg bags — two 30kg bags or two 26kg bags count as one "50kg-equivalent"
                    // bag (0.5 each), matching actual truck loading capacity rather than a literal
                    // kg count. 20kg bags are unchanged — still tracked for display only, no
                    // weighting rule was given for them. ──
                    runningWeightedBags += fiftyKgBagsThisStop
                        + (0.5m * thirtyKgBagsThisStop)
                        + (0.5m * twentySixKgBagsThisStop);

                    // ── Repeats every time cumulative weighted bags cross another multiple of
                    // the threshold (now 130, was 110) ──
                    var currentMilestoneCount = (int)(runningWeightedBags / BagLoadingThreshold);
                    var crossedMilestones = new List<int>();
                    for (var m = announcedMilestoneCount + 1; m <= currentMilestoneCount; m++)
                    {
                        crossedMilestones.Add(m * BagLoadingThreshold);
                    }
                    announcedMilestoneCount = Math.Max(announcedMilestoneCount, currentMilestoneCount);

                    stops.Add(new LoadingSheetStopDto
                    {
                        CustomerId = order.Customer.Id,
                        CustomerName = order.Customer.NameEnglish,
                        CustomerNameMalayalam = order.Customer.NameMalayalam,
                        SequenceOrder = stopNumber,
                        LoadingPosition = stopNumber,
                        IsFirstDelivery = stopNumber == 1,
                        IsLastDelivery = stopNumber == orderedOrders.Count,
                        VisitStatus = VisitStatus.OrderPlaced,
                        Items = groupedItems,
                        StopTotalQuantity = stopTotal,
                        OrderNumber = order.OrderNumber,
                        Remarks = string.IsNullOrWhiteSpace(order.Remarks) ? null : order.Remarks,
                        FiftyKgThresholdMilestonesCrossed = crossedMilestones,
                        RunningFiftyKgBagTotal = runningFiftyKgBags,
                        RunningThirtyKgBagTotal = runningThirtyKgBags,
                        RunningTwentySixKgBagTotal = runningTwentySixKgBags,
                        RunningTwentyKgBagTotal = runningTwentyKgBags,
                        RunningWeightedBagTotal = runningWeightedBags,
                    });

                    stopNumber++;
                }

                routeSummaries.Add(new LoadingSheetRouteSummaryDto
                {
                    RouteId = routeGroup.Key.RouteId,
                    RouteName = routeGroup.Key.RouteName,
                    TotalOrders = routeOrders.Count,
                    TotalCustomers = stops.Count,
                    GrandTotalQuantity = routeTotalQty,
                    TotalBags = 0,
                    TotalBoxes = 0,
                    TotalTins = 0,
                    ItemSummary = itemSummaryDict.Values
                        .OrderBy(i => i.LoadingPriority)
                        .ThenBy(i => i.ProductName)
                        .ToList(),
                    // ── Size Group Summary now follows the admin-configured DB order
                    // (SizeGroup.SortOrder) rather than a plain numeric sort. ──
                    SizeGroupSummary = sizeGroupSummaryDict.Values
                        .OrderBy(sg => sg.SortKey)
                        .ThenByDescending(sg => sg.TotalQuantity)
                        .ToList(),
                    Stops = stops
                });
            }

            var pdfBytes = GenerateSimpleLoadingSheetPdf(routeSummaries, targetDate, request.RouteId.HasValue);
            return Result<byte[]>.Success(pdfBytes);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LoadingSheet] Error: {ex.Message}");
            Console.WriteLine($"[LoadingSheet] StackTrace: {ex.StackTrace}");

            var errorPdf = GenerateEmptyLoadingSheet(
                request.Date?.Date ?? DateTime.UtcNow.Date,
                $"Error generating loading sheet: {ex.Message}"
            );
            return Result<byte[]>.Success(errorPdf);
        }
    }

    private static string GetUnitTypeLabel(string unitName)
    {
        if (string.IsNullOrEmpty(unitName)) return "OTHER";

        var name = unitName.ToLowerInvariant();
        if (name.Contains("bag")) return "BAGS";
        if (name.Contains("box")) return "BOXES";
        if (name.Contains("carton")) return "CARTONS";
        if (name.Contains("case")) return "CASES";
        if (name.Contains("can")) return "CANS";
        if (name.Contains("tin")) return "TINS";
        if (name.Contains("piece") || name.Contains("pc")) return "PIECES";

        return "OTHER";
    }

    // ── Derives the container-type label (BAGS/CASES/TINS/CANS/...) directly from the
    // size-group name itself (e.g. "50 KG BAG" → "BAGS", "5 LTR CAN" → "CANS"), instead
    // of from whichever product's Unit.Name happened to be scanned first for that group.
    // This is what keeps the Size Group Summary consistent — bags always read as bags,
    // cans always read as cans — regardless of how individual products' units are named. ──
    private static string GetUnitTypeLabelFromSizeGroupName(string sizeGroupName)
    {
        if (string.IsNullOrWhiteSpace(sizeGroupName)) return "OTHER";

        var name = sizeGroupName.ToLowerInvariant();
        if (name.Contains("bag")) return "BAGS";
        if (name.Contains("case")) return "CASES";
        if (name.Contains("can")) return "CANS";
        if (name.Contains("tin")) return "TINS";
        if (name.Contains("box")) return "BOXES";
        if (name.Contains("carton")) return "CARTONS";
        if (name.Contains("piece") || name.Contains("pc")) return "PIECES";

        return "OTHER";
    }

    // ── Size Group Prioritization: the admin-configurable DB value (SizeGroup.SortOrder,
    // set from the Size Groups screen's up/down reorder controls) is now the primary
    // source of truth. Falls back to the client's originally hand-written priority list
    // only if a group has no SortOrder recorded (-1 / missing), and finally to parsing
    // the leading number out of the name ("25 KG" → 25) so any still-unmapped group at
    // least sorts in a sensible heaviest-first order, placed after every group that does
    // have a priority. ──
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

    // ── Matches a size-group name like "50 KG BAG" or "50 KG" against a specific weight,
    // regardless of trailing words (BAG/CASE/TIN/CAN) — used for the bag-count alert totals. ──
    private static bool MatchesSizeGroupWeight(string? sizeGroupName, int kg)
        => sizeGroupName != null && Regex.IsMatch(sizeGroupName, $@"\b{kg}\s*kg\b", RegexOptions.IgnoreCase);

    // ── NEW: flags products in the VEGETABLES and CHILLES item groups so they can be
    // marked with an "X" on the printed sheet — purely a visual flag for staff, no effect
    // on ordering, pricing, or anything else. Case-insensitive since admin-entered group
    // names could vary in casing. ──
    private static readonly HashSet<string> FlaggedProductGroups =
        new(StringComparer.OrdinalIgnoreCase) { "VEGETABLES", "CHILLES" };

    private static bool IsFlaggedProductGroup(string? productGroupName)
        => productGroupName != null && FlaggedProductGroups.Contains(productGroupName.Trim());

    // ── PDF Generator: original block-per-stop layout (mirrors the Billing Sheet's style) —
    // route header, then one block per customer stop with a Product/Qty table underneath.
    // Order # is intentionally not shown anywhere in this layout, and retail/weigh remarks
    // are shown without the "RETAIL / WEIGH" label. ──
    private static byte[] GenerateSimpleLoadingSheetPdf(
        List<LoadingSheetRouteSummaryDto> routes,
        DateTime targetDate,
        bool isSingleRoute)
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
                            col.Item().Text("LOADING SHEET").FontSize(16).Bold();
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
                                // ── Route Header (name centered) ──
                                routeCol.Item().Background(Colors.Grey.Lighten2)
                                    .Padding(6)
                                    .AlignCenter()
                                    .Text($"{route.RouteName.ToUpper()}").FontSize(18).Bold();

                                // ── NEW: live, per-item threshold tracking for this route — replaces the
                                // old per-STOP-only check. Weighted bags accumulate as each grouped product
                                // line is about to be rendered, and the moment a multiple of the threshold
                                // (130, 260, 390...) is crossed, an alert is inserted right there — between
                                // that item and the next one — instead of only ever appearing once, after
                                // the whole customer's order was already fully printed. Declared per-route
                                // since the threshold applies across the whole route, same as before.
                                //
                                // FIX: this used to track TWO separate running totals — a never-reset
                                // liveWeightedTotal for detecting crossings, and separately-reset breakdown
                                // counts (50/30/26kg) for display. Every time a cycle overshot past 130
                                // (e.g. actually reached 139), that 9-unit overshoot stayed baked into the
                                // never-reset detector but was silently discarded when the display counters
                                // reset to zero. That lost overshoot compounded with every cycle, so later
                                // alerts could show a total UNDER 130 while still claiming the limit was
                                // crossed. Now there's just ONE running total (cycleWeightedTotal) used for
                                // both deciding when to fire an alert and what to display — they can never
                                // diverge from each other again. ──
                                var cycleWeightedTotal = 0m;
                                var liveFiftyKg = 0;
                                var liveThirtyKg = 0;
                                var liveTwentySixKg = 0;
                                var liveTwentyKg = 0;

                                // ── Renders one segment of a stop's item table. `showHeader` is false for
                                // continuation segments (after an alert splits a stop's items) so the "QTY"
                                // header doesn't repeat mid-customer — same table styling either way. ──
                                void RenderItemSegment(QuestPDF.Infrastructure.IContainer container, List<LoadingSheetItemDto> segmentItems, bool showHeader)
                                {
                                    // ── FIX: switched from Table() to individual Row()-per-item, each
                                    // wrapped in ShowEntire(). QuestPDF's Table rows were splitting mid-row
                                    // across a page boundary in this nested context (product name on one
                                    // page, qty on the next) — visually broken. ShowEntire() on the WHOLE
                                    // table was already ruled out earlier (that's what caused the original
                                    // "conflicting size constraints" crash on large orders). Applying it to
                                    // just ONE row at a time is safe: a single Product/Qty line is tiny and
                                    // will always fit somewhere, so it can never trigger that crash — while
                                    // the Column as a whole still paginates freely between rows exactly like
                                    // before, so large orders still split page-to-page between items, just
                                    // never mid-item anymore. ──
                                    container.AlignCenter().Width(360).PaddingTop(4).Column(itemsCol =>
                                    {
                                        if (showHeader)
                                        {
                                            itemsCol.Item().ShowEntire().Row(row =>
                                            {
                                                row.RelativeItem(3).BorderBottom(1).PaddingVertical(4).PaddingLeft(5).Text("");
                                                row.RelativeItem(1).BorderBottom(1).PaddingVertical(4).PaddingRight(5)
                                                    .AlignRight().Text("QTY").Bold().FontSize(18);
                                            });
                                        }

                                        foreach (var item in segmentItems)
                                        {
                                            var isFlagged = IsFlaggedProductGroup(item.ProductGroupName);
                                            var productNameText = item.ProductName.ToUpper();

                                            itemsCol.Item().ShowEntire().Row(row =>
                                            {
                                                // FIX: X marker rendered as its own larger, bolder text span
                                                // within the same cell — was previously just appended as plain
                                                // text at the same size/weight as the product name, which read
                                                // as too thin. This keeps it inline (no new column, no layout
                                                // change) but visibly heavier and bigger than the surrounding
                                                // text, since it's now its own span with a bigger font size.
                                                row.RelativeItem(3).BorderBottom(1.5f)
                                                    .PaddingVertical(3).PaddingLeft(5)
                                                    .Text(text =>
                                                    {
                                                        text.Span(productNameText).FontSize(18).ExtraBold();
                                                        if (isFlagged)
                                                        {
                                                            text.Span("  X").FontSize(26).ExtraBold().FontColor(Colors.Black);
                                                        }
                                                    });

                                                row.RelativeItem(1).BorderBottom(1.5f)
                                                    .PaddingVertical(3).PaddingRight(5).AlignRight()
                                                    .Text($"{item.TotalQuantity:N0} {item.UnitSymbol}").FontSize(18).ExtraBold();
                                            });
                                        }
                                    });
                                }

                                // ── One block per customer stop (numbering stays left, name centered & large) ──
                                // ShowEntire() keeps a stop's header + product table + remarks together as one
                                // unit — if it doesn't fully fit on the current page, the whole block moves to
                                // the next page instead of splitting a customer's products across pages.
                                foreach (var stop in route.Stops)
                                {
                                    // FIX: ShowEntire() removed here — a stop with a large item count
                                    // (seen in production: 21+ items on one order) plus the retail-items
                                    // divider/label/remarks can be taller than a single blank page.
                                    // ShowEntire() has no fallback for that case — it throws a hard
                                    // "conflicting size constraints" layout exception instead of just
                                    // splitting the block, which was silently failing the whole PDF for
                                    // routes with genuinely large orders (production data), even though
                                    // it never showed up against smaller local test data. Letting the
                                    // block paginate normally means a very large stop's table can now
                                    // split across two pages instead — a much better trade-off than the
                                    // entire report failing to generate.
                                    // FIX: EnsureSpace() instead of a plain Column() — reserves a minimum
                                    // block of space so this stop's header row can't get stranded alone at
                                    // the very bottom of a page with its item table starting fresh on the
                                    // next one. Unlike ShowEntire() (removed above for the same block), this
                                    // doesn't require the ENTIRE stop to fit before starting it — a genuinely
                                    // huge table can still paginate normally after the reserved minimum, so
                                    // this can't reintroduce the "conflicting size constraints" crash.
                                    routeCol.Item().PaddingTop(8).EnsureSpace().Column(stopCol =>
                                    {
                                        // ── Number sits in a wider left column, right-aligned, so it lands partway
                                        // across the row (per client mark-up) instead of hugging the far-left edge
                                        // or crowding right up against the customer name. Left/right columns are
                                        // kept equal width so the name is still truly centered on the row. ──
                                        stopCol.Item().Background(Colors.Grey.Lighten3)
                                            .Padding(4)
                                            .Row(r =>
                                            {
                                                r.ConstantItem(100).AlignRight().Text($"{stop.SequenceOrder})").FontSize(18).ExtraBold();
                                                r.RelativeItem().AlignCenter().Text(stop.CustomerName.ToUpper()).FontSize(18).ExtraBold();
                                                r.ConstantItem(100);
                                            });

                                        // Replace the table definition section (around line 260-280) with:

                                        if (stop.Items.Count > 0)
                                        {
                                            // ── FIX: restored the loading-limit alert to fire at the EXACT
                                            // item where a threshold (130, 260, 390...) is crossed, instead
                                            // of only once after the customer's whole order was already
                                            // printed. Walks this stop's items one grouped product-line at a
                                            // time, accumulating the weighted bag total; the moment a new
                                            // multiple of the threshold is crossed, the items rendered so far
                                            // are drawn as their own table segment, the alert box is inserted
                                            // right there, and the remaining items continue in a fresh segment
                                            // below it — still inside this same customer's block. ──
                                            var segment = new List<LoadingSheetItemDto>();
                                            var segmentIndex = 0;

                                            foreach (var item in stop.Items)
                                            {
                                                segment.Add(item);

                                                var weight = MatchesSizeGroupWeight(item.SizeGroupName, 50) ? 1m
                                                    : (MatchesSizeGroupWeight(item.SizeGroupName, 30) || MatchesSizeGroupWeight(item.SizeGroupName, 26)) ? 0.5m
                                                    : 0m;
                                                var qty = (int)item.TotalQuantity;

                                                if (MatchesSizeGroupWeight(item.SizeGroupName, 50)) liveFiftyKg += qty;
                                                else if (MatchesSizeGroupWeight(item.SizeGroupName, 30)) liveThirtyKg += qty;
                                                else if (MatchesSizeGroupWeight(item.SizeGroupName, 26)) liveTwentySixKg += qty;
                                                else if (MatchesSizeGroupWeight(item.SizeGroupName, 20)) liveTwentyKg += qty;

                                                // FIX: single running total drives BOTH the crossing check and
                                                // the displayed number — see the declaration above for why the
                                                // old two-total approach caused later alerts to under-report.
                                                cycleWeightedTotal += weight * qty;

                                                if (cycleWeightedTotal >= BagLoadingThreshold)
                                                {
                                                    // Draw everything accumulated so far as its own segment...
                                                    stopCol.Item().Element(c => RenderItemSegment(c, segment, segmentIndex == 0));
                                                    segment = [];
                                                    segmentIndex++;

                                                    // FIX: alert message shortened to a single line, per
                                                    // updated request — removed the per-type breakdown and
                                                    // "STOP" wording. Still uses cycleWeightedTotal (same
                                                    // number that triggers the alert) as [X], so the message
                                                    // can never show a value inconsistent with what actually
                                                    // crossed the threshold.
                                                    stopCol.Item().PaddingTop(6).EnsureSpace()
                                                        .Background(Colors.Red.Lighten3).Padding(6)
                                                        .Text($"Combined total (50kg) has reached {cycleWeightedTotal:0.#} bags. Threshold limit is {BagLoadingThreshold}. Do not load more than {BagLoadingThreshold} bags.")
                                                        .Bold().FontSize(16).FontColor(Colors.Red.Darken2);

                                                    // Reset everything together for the next cycle — total and
                                                    // breakdown counts always move in lockstep now, so they can
                                                    // never drift apart from each other again.
                                                    cycleWeightedTotal = 0m;
                                                    liveFiftyKg = 0;
                                                    liveThirtyKg = 0;
                                                    liveTwentySixKg = 0;
                                                    liveTwentyKg = 0;
                                                }
                                            }

                                            // Whatever's left after the last crossing (or the whole list, if
                                            // no threshold was crossed in this stop at all).
                                            if (segment.Count > 0)
                                            {
                                                stopCol.Item().Element(c => RenderItemSegment(c, segment, segmentIndex == 0));
                                            }
                                        }
                                        else if (stop.Remarks == null)
                                        {
                                            stopCol.Item().AlignCenter().Width(360).PaddingLeft(5).Padding(3).Text("—").FontSize(10);
                                        }

                                        // ── Retail items / remarks — plain black text, no background shade, no "RETAIL / WEIGH" label ──
                                        // Wrapped with the same AlignCenter().Width(360) + PaddingLeft(5) as the
                                        // product table above, so remarks line up directly under the PRODUCT column
                                        // instead of sitting further left than the table.
                                        if (stop.Remarks != null)
                                        {
                                            stopCol.Item().EnsureSpace().Column(remarksCol =>
                                            {
                                                // Using a full-width line with padding to make it visually distinct
                                                remarksCol.Item().AlignCenter().Width(520).PaddingTop(6).PaddingBottom(4)
                                                    .LineHorizontal(2.5f);
                                                // ── RETAIL ITEMS LABEL ──
                                                remarksCol.Item().AlignCenter().Width(520).PaddingLeft(5).PaddingTop(2)
                                                    .Text("RETAIL ITEMS:").FontSize(14).ExtraBold().FontColor(Colors.Grey.Darken2);
                                                remarksCol.Item().AlignCenter().Width(520).PaddingLeft(5).PaddingTop(4)
                                                    .Text(stop.Remarks.ToUpper()).FontSize(18).ExtraBold().FontColor(Colors.Black);
                                            });
                                        }
                                    });

                                    // ── FIX: the old post-stop alert loop that lived here has been removed —
                                    // replaced by the live, per-item alert insertion above (inside stopCol),
                                    // which fires at the exact item where a threshold is crossed instead of
                                    // only once after the whole customer's order was already printed. ──
                                }

                                // FIX: Size Group Summary removed from the end of the loading sheet per
                                // request — it's no longer shown here. (route.SizeGroupSummary itself is
                                // still computed upstream and untouched, in case anything else relies on
                                // it; this only removes its rendering on this particular report.)

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
                            x.Span($"  |  Generated: {DateTime.UtcNow:HH:mm:ss}");
                        });
                });
            }).GeneratePdf();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LoadingSheet-PDF] Error: {ex.Message}");
            return GenerateEmptyLoadingSheet(targetDate, $"PDF generation error: {ex.Message}");
        }
    }

    private static byte[] GenerateEmptyLoadingSheet(DateTime targetDate, string message)
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
                                col.Item().Text("LOADING SHEET").FontSize(14).Bold();
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
                            col.Item().Text("⚠️ No Data Available").FontSize(14).Bold().FontColor(Colors.Orange.Medium);
                            col.Item().Text(message).FontSize(10).FontColor(Colors.Grey.Medium);
                            col.Item().PaddingTop(20).Text("Possible reasons:").FontSize(9).FontColor(Colors.Grey.Medium);
                            col.Item().Text("• No closed orders found for this route/date").FontSize(9).FontColor(Colors.Grey.Medium);
                            col.Item().Text("• Orders are still in Draft or Approved status").FontSize(9).FontColor(Colors.Grey.Medium);
                            col.Item().Text("• Admin must close orders before loading sheet generation").FontSize(9).FontColor(Colors.Grey.Medium);
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