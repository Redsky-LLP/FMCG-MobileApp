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
    // Loading workers get a highlighted alert once a route's 50kg bag count reaches this.
    private const int FiftyKgBagThreshold = 110;

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

                    // ── Running totals for 30kg / 26kg / 20kg bags — tracked purely for
                    // display alongside the 50kg alert, no threshold logic of their own. ──
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

                    // ── Repeats every time cumulative bags cross another multiple of the threshold ──
                    var currentMilestoneCount = runningFiftyKgBags / FiftyKgBagThreshold;
                    var crossedMilestones = new List<int>();
                    for (var m = announcedMilestoneCount + 1; m <= currentMilestoneCount; m++)
                    {
                        crossedMilestones.Add(m * FiftyKgBagThreshold);
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
                                            // Narrower, centered table: capping the width tightens the gap between
                                            // the PRODUCT and QTY columns further, pushing the leftover space out
                                            // to equal left/right margins instead of sitting between the columns.
                                            stopCol.Item().AlignCenter().Width(360).PaddingTop(4).Table(table =>
                                            {
                                                table.ColumnsDefinition(columns =>
                                                {
                                                    columns.RelativeColumn(3);  // Product ≈ 75%
                                                    columns.RelativeColumn(1);  // Qty ≈ 25%
                                                });

                                                table.Header(header =>
                                                {
                                                    // "PRODUCT" label intentionally omitted on the loading sheet —
                                                    // item names are self-explanatory and the label just adds
                                                    // noise. The cell (and its bottom border) stays so column
                                                    // widths and the underline still line up with the QTY header.
                                                    header.Cell().BorderBottom(1)
                                                        .PaddingVertical(4)
                                                        .PaddingLeft(5)
                                                        .Text("");

                                                    header.Cell().BorderBottom(1)
                                                        .PaddingVertical(4)
                                                        .PaddingRight(5)
                                                        .AlignRight()
                                                        .Text("QTY")
                                                        .Bold()
                                                        .FontSize(18);
                                                });

                                                foreach (var item in stop.Items)
                                                {
                                                    // Product name - left aligned, extra bold and larger for readability
                                                    // NOTE: size-group name is intentionally NOT appended here anymore
                                                    // (admin already conveys size via the product name/entry itself).
                                                    // This is purely a display change — item.SizeGroupSortKey still
                                                    // drives the ordering above and the Size Group Summary below,
                                                    // nothing about the backend priority logic changed.
                                                    table.Cell().BorderBottom(0.5f)
                                                        .PaddingVertical(3)
                                                        .PaddingLeft(5)
                                                        .Text(item.ProductName.ToUpper())
                                                        .FontSize(18)
                                                        .ExtraBold();

                                                    // Quantity right aligned, extra bold and larger for readability
                                                    table.Cell().BorderBottom(0.5f)
                                                        .PaddingVertical(3)
                                                        .PaddingRight(5)
                                                        .AlignRight()
                                                        .Text($"{item.TotalQuantity:N0} {item.UnitSymbol}")
                                                        .FontSize(18)
                                                        .ExtraBold();
                                                }
                                            });
                                        }
                                        else if (stop.Remarks == null)
                                        {
                                            stopCol.Item().AlignCenter().Width(360).PaddingLeft(5).Padding(3).Text("—").FontSize(10);
                                        }

                                        // ── Retail items / remarks — plain black text, no background shade, no "RETAIL / WEIGH" label ──
                                        // Wrapped with the same AlignCenter().Width(360) + PaddingLeft(5) as the
                                        // product table above, so remarks line up directly under the PRODUCT column
                                        // instead of sitting further left than the table.
                                        //
                                        // FIX: ShowEntire() replaced with EnsureSpace() here too — same reasoning
                                        // as the outer per-stop block above. A long Remarks string on a large
                                        // order can render taller than a single blank page on its own, and
                                        // ShowEntire() has no fallback for that: it throws the hard "conflicting
                                        // size constraints" exception instead of letting this block paginate.
                                        // EnsureSpace() still keeps the divider/label glued to the start of the
                                        // remarks text (no orphaned label at the bottom of a page) without
                                        // requiring the whole block to fit in one page.
                                        if (stop.Remarks != null)
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
                                                    .Text(stop.Remarks.ToUpper()).FontSize(18).ExtraBold().FontColor(Colors.Black);
                                            });
                                        }
                                    });

                                    // ── 50kg bag threshold alert(s), inserted right after the stop that crossed them ──
                                    // Repeats every time cumulative bags cross another multiple (110, 220, 330...).
                                    // Also shows the current running totals for 30kg / 26kg / 20kg bags at this
                                    // point in the route, purely so the loader can see where all four bag sizes stand
                                    // together whenever the 50kg alert fires — no threshold logic for these three.
                                    // ── FIX: ShowEntire() replaced with EnsureSpace(). A single large order can
                                    // cross several 110-bag milestones at once (crossedMilestones can hold more
                                    // than one entry per stop), so this loop can emit multiple alert boxes back
                                    // to back near the bottom of a page. ShowEntire() forced every one of them to
                                    // fit entirely within whatever space remained (or fail outright); EnsureSpace()
                                    // still avoids stranding an alert box's opening line alone at the page bottom,
                                    // without being able to throw the "conflicting size constraints" exception. ──
                                    foreach (var milestone in stop.FiftyKgThresholdMilestonesCrossed)
                                    {
                                        routeCol.Item().PaddingTop(6).EnsureSpace()
                                            .Background(Colors.Red.Lighten3).Padding(6)
                                            .Text($"⚠ ALERT: 50 KG BAGS HAVE REACHED {milestone}+ (RUNNING TOTAL: {stop.RunningFiftyKgBagTotal}) — AFTER \"{stop.CustomerName.ToUpper()}\" — ALSO CHECK: 30 KG BAGS: {stop.RunningThirtyKgBagTotal}, 26 KG BAGS: {stop.RunningTwentySixKgBagTotal}, 20 KG BAGS: {stop.RunningTwentyKgBagTotal} — VERIFY LOADING CAPACITY")
                                            .Bold().FontSize(18).FontColor(Colors.Red.Darken2);
                                    }
                                }

                                // ── Size Group Summary (end of route) — helps loaders plan bag counts by weight ──
                                // FIX: ShowEntire() replaced with EnsureSpace(). A route built from a large order
                                // (or many orders) can span enough distinct size groups that this summary no
                                // longer fits on a single blank page, which is exactly what ShowEntire() cannot
                                // handle — it demands the entire block fit in one page or throws. EnsureSpace()
                                // keeps the "📦 SIZE GROUP SUMMARY" heading glued to its first entries while still
                                // allowing the list itself to paginate normally if it runs long. ──
                                if (route.SizeGroupSummary.Count > 0)
                                {
                                    routeCol.Item().PaddingTop(10).EnsureSpace()
                                        .Background(Colors.Blue.Lighten5)
                                        .Padding(8)
                                        .Column(sgCol =>
                                        {
                                            sgCol.Item().Text("📦 SIZE GROUP SUMMARY").FontSize(18).Bold();
                                            var i = 1;
                                            foreach (var sg in route.SizeGroupSummary)
                                            {
                                                sgCol.Item().PaddingTop(2).Text($"{i}. {sg.SizeGroupName.ToUpper()} — {sg.TotalQuantity:N0} {sg.UnitTypeLabel}").FontSize(18).Bold();
                                                i++;
                                            }
                                        });
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