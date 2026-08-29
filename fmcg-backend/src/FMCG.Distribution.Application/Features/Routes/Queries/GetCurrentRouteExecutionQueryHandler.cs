// PATH: src/FMCG.Distribution.Application/Features/Routes/Queries/GetCurrentRouteExecutionQueryHandler.cs
// UPDATED: Removed the "ExecutionDate.Date == today" filter when looking up the
// current execution. An open execution (not Completed, not Abandoned) must stay
// "current" across a calendar-day rollover — it should only stop being current
// once admin explicitly closes the day. Without this, a route looked "fresh"
// again purely because the date changed, even though nothing was ever closed.
// FIXES (carried over):
//   IDE0290: Use primary constructor
//   CA1860:  .Any() → .Count > 0
//   IDE0028: Collection initialization simplified

using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetCurrentRouteExecutionQueryHandler(IApplicationDbContext context)  // IDE0290
    : IRequestHandler<GetCurrentRouteExecutionQuery, Result<CurrentRouteExecutionDto>>
{
    public async Task<Result<CurrentRouteExecutionDto>> Handle(
        GetCurrentRouteExecutionQuery request,
        CancellationToken cancellationToken)
    {
        // No date filter here — an execution stays "current" until it's
        // explicitly Completed (admin's Close Day) or Abandoned, regardless of
        // which calendar day it was originally started on. This is what lets
        // a route stay open into the next morning for catch-up orders until
        // admin actually closes it. OrderByDescending just guards against the
        // unlikely case of more than one open execution existing.
        var execution = await context.RouteExecutions
            .Include(e => e.Visits!)
                .ThenInclude(v => v.Customer)
            .Where(
                e => e.RouteId == request.RouteId
                  && e.SalesmanId == request.SalesmanId
                  && e.Status != ExecutionStatus.Completed
                  && e.Status != ExecutionStatus.Abandoned)
            .OrderByDescending(e => e.ExecutionDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (execution == null)
        {
            return Result<CurrentRouteExecutionDto>.Success(new CurrentRouteExecutionDto
            {
                HasActiveExecution = false
            });
        }

        // FIX: If execution is still Draft (Start() result was never persisted), start it now
        if (execution.Status == ExecutionStatus.Draft)
        {
            execution.Start();
            await context.SaveChangesAsync(cancellationToken);
        }

        // ── Sync: add visits for customers added after execution started ──────
        // PERFORMANCE FIX: read-only lookup, never mutated/saved — safe to skip
        // EF's change-tracking overhead for it.
        var routeCustomers = await context.Customers
            .AsNoTracking()
            .Where(c => c.RouteId == request.RouteId && c.IsActive && !c.IsDeleted)
            .OrderBy(c => c.SequenceOrder)
            .ToListAsync(cancellationToken);

        var existingVisitCustomerIds = execution.Visits?
            .Select(v => v.CustomerId)
            .ToHashSet() ?? [];   // IDE0028

        var missingCustomers = routeCustomers
            .Where(c => !existingVisitCustomerIds.Contains(c.Id))
            .ToList();

        if (missingCustomers.Count > 0)  // CA1860
        {
            int maxSeq = execution.Visits?.Count > 0  // CA1860
                ? execution.Visits.Max(v => v.SequenceOrder)
                : 0;

            var newVisits = missingCustomers
                .Select((c, idx) => new CustomerVisit
                {
                    Id = Guid.NewGuid(),
                    RouteExecutionId = execution.Id,
                    CustomerId = c.Id,
                    SequenceOrder = c.SequenceOrder > 0 ? c.SequenceOrder : maxSeq + idx + 1,
                    Status = VisitStatus.Pending
                })
                .ToList();

            await context.CustomerVisits.AddRangeAsync(newVisits, cancellationToken);

            // ── FIX: two overlapping requests can both reach this point believing
            // the same customer is "missing" a visit (see the unique index added
            // on CustomerVisits(RouteExecutionId, CustomerId) in
            // ApplicationDbContext for the actual guarantee). Whichever request
            // saves second now hits that constraint and throws — that's expected
            // and means the other request already added the visit, so it's safe
            // to swallow here rather than surfacing an error to the salesman.
            // Either way, the reload right below picks up whatever's actually in
            // the database now. ──
            try
            {
                await context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                foreach (var entry in context.ChangeTracker.Entries<CustomerVisit>())
                {
                    if (newVisits.Contains(entry.Entity))
                        entry.State = EntityState.Detached;
                }
            }

            // Reload with new visits
            execution = await context.RouteExecutions
                .Include(e => e.Visits!)
                    .ThenInclude(v => v.Customer)
                .FirstAsync(e => e.Id == execution.Id, cancellationToken);
        }
        // ─────────────────────────────────────────────────────────────────────

        // PERFORMANCE FIX: read-only, purely for display — never mutated/saved.
        var route = await context.Routes
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == execution.RouteId && !r.IsDeleted, cancellationToken);

        var visits = execution.Visits ?? [];   // IDE0028
        var total = visits.Count;
        var completed = visits.Count(v => v.Status != VisitStatus.Pending);
        var pending = visits.Count(v => v.Status == VisitStatus.Pending);

        // Auto-fix SequenceOrder=0: assign 1,2,3... if all are 0
        var orderedVisits = visits.All(v => v.SequenceOrder == 0)
            ? visits.Select((v, idx) => { v.SequenceOrder = idx + 1; return v; }).ToList()
            : [.. visits.OrderBy(v => v.SequenceOrder)];   // IDE0305

        var customers = orderedVisits.Select(v => new CustomerVisitStatusDto   // IDE0305
        {
            VisitId = v.Id,
            CustomerId = v.CustomerId,
            CustomerName = v.Customer?.NameEnglish ?? string.Empty,
            CustomerNameMalayalam = v.Customer?.NameMalayalam,
            PhoneNumber = v.Customer?.PhoneNumber,
            Address = v.Customer?.Address,
            SequenceOrder = v.SequenceOrder,
            VisitStatus = v.Status.ToString(),
            OrderId = v.OrderId,
            SkipReason = v.SkipReason,
        }).ToList();

        // ── NEW: bags breakdown for this route/day.
        //
        // FIX: no longer restricted to Closed/Locked orders. Salesman orders
        // sit in Draft status for the entire working day — they only become
        // Closed once admin closes the route/day, often hours later. Since
        // this is a live "how many bags have I loaded so far" indicator for
        // the salesman DURING their route (not a financial report), it needs
        // to count an order the moment it's saved, not wait for a closure
        // that hasn't happened yet — otherwise this shows 0 all day.
        //
        // FIX: matching by OrderDate == ExecutionDate was also wrong on its
        // own — this handler's class-level comment explains an execution can
        // legitimately stay "current" across a calendar-day rollover until
        // admin closes it, so ExecutionDate can still be yesterday's date
        // while a just-placed order already has today's OrderDate. That
        // silently excluded every order placed after midnight. Matching
        // directly against this execution's own visits (v.OrderId) instead
        // is unambiguous — it only counts orders actually recorded against
        // THIS execution, with no date comparison involved at all.
        //
        // FIX: switched from Unit.BaseUnitValue to SizeGroupName text
        // matching. BaseUnitValue looked like the cleaner, more reliable
        // field on paper, but it's actually NULL across this app's real
        // data — nobody ever populates it through the admin UI. SizeGroup
        // (e.g. "50 KG BAG") is what's actually set and what the Loading
        // Sheet report already successfully keys off of, so this now uses
        // the same MatchesSizeGroupWeight-style regex match instead. ──
        var bagsBreakdown = new BagsBreakdownDto();
        var executionOrderIds = (execution.Visits ?? [])
            .Where(v => v.OrderId.HasValue)
            .Select(v => v.OrderId!.Value)
            .ToHashSet();

        var routeOrdersToday = executionOrderIds.Count == 0
            ? []
            : await context.Orders
                .AsNoTracking()
                .Include(o => o.Items!)
                    .ThenInclude(i => i.Product!)
                        .ThenInclude(p => p.SizeGroup)
                .Where(o => !o.IsDeleted && executionOrderIds.Contains(o.Id))
                .ToListAsync(cancellationToken);

        foreach (var order in routeOrdersToday)
        {
            if (order.Items == null) continue;
            foreach (var item in order.Items)
            {
                var sizeGroupName = item.SizeGroupNameAtTime ?? item.Product?.SizeGroup?.Name;
                var qty = (int)item.Quantity;
                if (MatchesSizeGroupWeight(sizeGroupName, 50)) bagsBreakdown.Count50Kg += qty;
                else if (MatchesSizeGroupWeight(sizeGroupName, 30)) bagsBreakdown.Count30Kg += qty;
                else if (MatchesSizeGroupWeight(sizeGroupName, 26)) bagsBreakdown.Count26Kg += qty;
            }
        }
        bagsBreakdown.TotalEquivalentBags =
            bagsBreakdown.Count50Kg
            + (0.5m * bagsBreakdown.Count30Kg)
            + (0.5m * bagsBreakdown.Count26Kg);

        return Result<CurrentRouteExecutionDto>.Success(new CurrentRouteExecutionDto
        {
            HasActiveExecution = true,
            ExecutionId = execution.Id,
            Status = execution.Status.ToString(),
            ExecutionDate = execution.ExecutionDate,
            RouteName = route?.Name ?? string.Empty,
            TotalCustomers = total,
            CompletedCount = completed,
            PendingCount = pending,
            Customers = customers,
            BagsBreakdown = bagsBreakdown,
        });
    }

    // ── Matches a size-group name like "50 KG BAG" or "50 KG" against a
    // specific weight, regardless of trailing words — same helper pattern
    // already used successfully in GetLoadingSheetQueryHandler. ──
    private static bool MatchesSizeGroupWeight(string? sizeGroupName, int kg)
        => sizeGroupName != null && Regex.IsMatch(sizeGroupName, $@"\b{kg}\s*kg\b", RegexOptions.IgnoreCase);
}