using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Reports.Queries;
using FMCG.Distribution.Application.Features.Settlement.Commands;
using FMCG.Distribution.Application.Features.Settlement.DTOs;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace FMCG.Distribution.Infrastructure.Services;

public class SettlementService(IApplicationDbContext context, IMediator mediator) : ISettlementService
{
    public async Task<ExpectedCashDto> CalculateExpectedCashAsync(Guid? routeId, DateTime? date, CancellationToken cancellationToken = default)
    {
        var targetDate = date ?? DateTime.UtcNow.Date;

        // Get submitted and closed orders (not draft)
        var ordersQuery = context.Orders
            .Include(o => o.Items)
            .Where(o => !o.IsDeleted && o.Status != OrderStatus.Draft);

        if (routeId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.RouteId == routeId.Value);
        }

        // Filter by order date (only orders up to target date)
        ordersQuery = ordersQuery.Where(o => o.OrderDate <= targetDate);

        var orders = await ordersQuery.ToListAsync(cancellationToken);

        // Calculate totals
        decimal totalSales = 0;
        int customerCount = 0;
        var customerIds = new HashSet<Guid>();

        foreach (var order in orders)
        {
            var orderTotal = order.Items?.Sum(i => i.SellingPrice * i.Quantity) ?? 0;
            totalSales += orderTotal;

            if (order.CustomerId != Guid.Empty)
            {
                customerIds.Add(order.CustomerId);
            }
        }
        customerCount = customerIds.Count;

        // Get outstanding amounts from Outstanding table
        var outstandingQuery = context.Outstandings
            .Include(o => o.Customer)
            .Where(o => !o.IsDeleted && o.SettlementStatus != SettlementStatus.Settled);

        if (routeId.HasValue)
        {
            outstandingQuery = outstandingQuery
                .Where(o => o.Customer != null && o.Customer.RouteId == routeId.Value);
        }

        var outstandings = await outstandingQuery.ToListAsync(cancellationToken);
        var totalOutstanding = outstandings.Sum(o => o.OutstandingAmount);

        var expectedCash = totalSales - totalOutstanding;
        if (expectedCash < 0) expectedCash = 0;

        return new ExpectedCashDto
        {
            TotalSales = totalSales,
            TotalOutstanding = totalOutstanding,
            ExpectedCash = expectedCash,
            OrderCount = orders.Count,
            CustomerCount = customerCount,
            CalculatedAt = DateTime.UtcNow
        };
    }

    public async Task<ClosureValidationDto> ValidateSettlementBeforeClosureAsync(Guid? routeId, DateTime? date, CancellationToken cancellationToken = default)
    {
        var errors = new List<string>();
        var targetDate = date ?? DateTime.UtcNow.Date;

        // NOTE: deliberately NOT blocking on draft orders here. Under the
        // current workflow there's no "Submit All" step — orders are created
        // as Draft and stay that way until admin individually reviews/approves
        // them, which can be indefinitely. Drafts are already excluded from
        // the settlement totals below (CalculateExpectedCashAsync filters
        // them out), so they have zero effect on the closure's accuracy.

        // ── "already closed" is checked per ROUTE + date. ──
        // ── BUG FIX: was missing `c.IsActive` — after a route is reopened,
        // its old closure record is deactivated (IsActive = false) but not
        // deleted. Without this check, trying to close the route again after
        // a reopen would incorrectly say "already closed" forever. ──
        var existingClosure = await context.DailyClosures
            .FirstOrDefaultAsync(c => !c.IsDeleted
                && c.IsActive
                && c.ClosureDate.Date == targetDate.Date
                && c.RouteId == routeId, cancellationToken);

        if (existingClosure != null)
        {
            errors.Add($"This route is already closed for {targetDate:yyyy-MM-dd}.");
        }

        // Calculate settlement summary (already route-scoped)
        var summary = await CalculateExpectedCashAsync(routeId, targetDate, cancellationToken);

        return new ClosureValidationDto
        {
            IsValid = errors.Count == 0,
            ValidationErrors = errors,
            SettlementSummary = summary
        };
    }

    public async Task<OutstandingSummaryDto> GetOutstandingTotalsAsync(Guid? routeId, Guid? customerId, CancellationToken cancellationToken = default)
    {
        var query = context.Outstandings
            .Include(o => o.Customer)
            .Where(o => !o.IsDeleted && o.SettlementStatus != SettlementStatus.Settled);

        if (routeId.HasValue)
        {
            query = query.Where(o => o.Customer != null && o.Customer.RouteId == routeId.Value);
        }

        if (customerId.HasValue)
        {
            query = query.Where(o => o.CustomerId == customerId.Value);
        }

        var outstandings = await query.ToListAsync(cancellationToken);

        var customers = outstandings
            .GroupBy(o => o.CustomerId)
            .Select(g => new OutstandingCustomerDto
            {
                CustomerId = g.Key,
                CustomerName = g.First().Customer?.NameEnglish ?? string.Empty,
                CustomerNameMalayalam = g.First().Customer?.NameMalayalam,
                OutstandingAmount = g.Sum(o => o.OutstandingAmount),
                OpenOrdersCount = g.Count()
            })
            .ToList();

        return new OutstandingSummaryDto
        {
            TotalOutstanding = customers.Sum(c => c.OutstandingAmount),
            CustomersWithOutstanding = customers.Count,
            Customers = customers
        };
    }

    public async Task<DailyClosureResultDto> CloseOperationalDayAsync(Guid closedByUserId, DateTime closureDate, Guid routeId, string? notes, CancellationToken cancellationToken = default)
    {
        // ── DEBUG LOGGING ──
        Console.WriteLine($"[CloseRoute] ========================================");
        Console.WriteLine($"[CloseRoute] Closing route {routeId} for date: {closureDate}");
        Console.WriteLine($"[CloseRoute] ClosedByUserId: {closedByUserId}");
        Console.WriteLine($"[CloseRoute] ========================================");

        // ── CHANGED: validate for THIS route only ──
        var validation = await ValidateSettlementBeforeClosureAsync(routeId, closureDate, cancellationToken);

        if (!validation.IsValid)
        {
            Console.WriteLine($"[CloseRoute] Validation failed: {string.Join("; ", validation.ValidationErrors)}");
            return new DailyClosureResultDto
            {
                Success = false,
                Message = string.Join("; ", validation.ValidationErrors)
            };
        }

        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted, cancellationToken);

        if (route == null)
        {
            Console.WriteLine($"[CloseRoute] Route {routeId} not found.");
            return new DailyClosureResultDto
            {
                Success = false,
                Message = "Route not found."
            };
        }

        // ── CHANGED: only lock orders belonging to THIS route ──
        var ordersToLock = await context.Orders
            .Include(o => o.Items)
            .Where(o => !o.IsDeleted
                && !o.IsLocked
                && o.RouteId == routeId
                && o.OrderDate.Date <= closureDate.Date)
            .ToListAsync(cancellationToken);

        Console.WriteLine($"[CloseRoute] Found {ordersToLock.Count} orders to lock for route {route.Name}");
        foreach (var order in ordersToLock)
        {
            Console.WriteLine($"  - Order {order.OrderNumber}: Status={order.Status}, OrderDate={order.OrderDate}, IsLocked={order.IsLocked}");
        }

        var draftCountAsOfClosure = ordersToLock.Count(o => o.Status == OrderStatus.Draft);

        // ── Lock each order AND change status from Draft to Closed ──
        var closureTimestamp = DateTime.UtcNow;
        foreach (var order in ordersToLock)
        {
            order.IsLocked = true;
            order.ClosedAt = closureTimestamp;
            order.ClosedByRouteClosure = true;

            if (order.Status == OrderStatus.Draft)
            {
                order.Status = OrderStatus.Closed;
                order.ClosedByRouteClosure = true;   // ← marks this flip as reversible by Reopen
            }

            order.UpdateTimestamp(closedByUserId.ToString());
        }

        Console.WriteLine($"[CloseRoute] Locked {ordersToLock.Count} orders at {closureTimestamp}");
        Console.WriteLine($"[CloseRoute] Changed {draftCountAsOfClosure} orders from Draft to Closed");

        // Create the closure record — now tagged to this route
        var summary = validation.SettlementSummary!;
        var closure = new DailyClosure
        {
            Id = Guid.NewGuid(),
            ClosureDate = closureDate,
            ClosedAt = DateTime.UtcNow,
            ClosedByUserId = closedByUserId,
            TotalSales = summary.TotalSales,
            TotalOutstanding = summary.TotalOutstanding,
            ExpectedCash = summary.ExpectedCash,
            IsActive = true,
            Notes = notes,
            RouteId = routeId,
            RouteName = route.Name,
        };

        await context.DailyClosures.AddAsync(closure, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        Console.WriteLine($"[CloseRoute] DailyClosure record saved with ID: {closure.Id}");

        // ── Close only THIS route's open execution — it becomes fresh again,
        // other routes (e.g. Mavelikkara) are untouched ──
        int closedRouteCount = 0;
        try
        {
            var closeDayResult = await mediator.Send(
                new FMCG.Distribution.Application.Features.Routes.Commands.CloseDayCommand
                {
                    AdminUserId = closedByUserId,
                    RouteId = routeId,
                },
                cancellationToken);

            if (closeDayResult.IsSuccess && closeDayResult.Data != null)
            {
                closedRouteCount = closeDayResult.Data.ClosedRouteCount;
                Console.WriteLine($"[CloseRoute] Closed {closedRouteCount} execution(s) for this route");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CloseRoute] Error closing route execution: {ex.Message}");
        }

        // ── Auto-generate reports post-closure, scoped to this route ──
        string? loadingUrl = null;
        string? billingUrl = null;

        try
        {
            var loadingResult = await mediator.Send(
                new GetLoadingSheetQuery { Date = closureDate, RouteId = routeId },
                cancellationToken);

            if (loadingResult.IsSuccess && loadingResult.Data != null)
            {
                loadingUrl = $"/api/v1/reports/loading-sheet?date={closureDate:yyyy-MM-dd}&routeId={routeId}";
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CloseRoute] Error generating loading sheet: {ex.Message}");
        }

        try
        {
            var billingResult = await mediator.Send(
                new GetBillingSheetQuery { Date = closureDate, RouteId = routeId },
                cancellationToken);

            if (billingResult.IsSuccess && billingResult.Data != null)
            {
                billingUrl = $"/api/v1/reports/billing-sheet?date={closureDate:yyyy-MM-dd}&routeId={routeId}";
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CloseRoute] Error generating billing sheet: {ex.Message}");
        }

        Console.WriteLine($"[CloseRoute] ========================================");
        Console.WriteLine($"[CloseRoute] {route.Name} closed successfully!");
        Console.WriteLine($"[CloseRoute] ========================================");

        return new DailyClosureResultDto
        {
            ClosureId = closure.Id,
            ClosureDate = closure.ClosureDate,
            ClosedAt = closure.ClosedAt,
            TotalSales = closure.TotalSales,
            TotalOutstanding = closure.TotalOutstanding,
            ExpectedCash = closure.ExpectedCash,
            Success = true,
            Message = BuildClosureMessage(route.Name, closure.ExpectedCash, closedRouteCount, draftCountAsOfClosure),
            LoadingSheetUrl = loadingUrl,
            BillingSheetUrl = billingUrl,
            ClosedRouteCount = closedRouteCount,
        };
    }

    // ── CHANGED: takes routeName so the message reads "Chengannur closed..."
    // instead of the old generic "Operational day closed..." ──
    private static string BuildClosureMessage(string routeName, decimal expectedCash, int closedRouteCount, int draftCount)
    {
        var parts = new List<string> { $"{routeName} closed successfully. Expected cash: {expectedCash:C}." };
        if (closedRouteCount > 0)
            parts.Add($"{routeName} is now fresh and available again for new orders.");
        if (draftCount > 0)
            parts.Add($"Note: {draftCount} draft order(s) on this route were never submitted and are now locked along with everything else — review them manually if needed.");
        return string.Join(" ", parts);
    }

    // ── NEW: Reopen Route Method ──────────────────────────────────────────────

    public async Task<ReopenRouteResultDto> ReopenRouteAsync(Guid adminUserId, DateTime closureDate, Guid routeId, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[ReopenRoute] ========================================");
        Console.WriteLine($"[ReopenRoute] Reopening route {routeId} for date: {closureDate}");
        Console.WriteLine($"[ReopenRoute] Requested by: {adminUserId}");
        Console.WriteLine($"[ReopenRoute] ========================================");

        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted, cancellationToken);

        if (route == null)
        {
            return new ReopenRouteResultDto { Success = false, Message = "Route not found." };
        }

        // Must have an active closure for this route+date — this is what
        // "already closed for THIS route" means (per-route uniqueness, same
        // check ValidateSettlementBeforeClosureAsync relies on).
        var closure = await context.DailyClosures
            .FirstOrDefaultAsync(c => !c.IsDeleted && c.IsActive
                && c.ClosureDate.Date == closureDate.Date
                && c.RouteId == routeId, cancellationToken);

        if (closure == null)
        {
            return new ReopenRouteResultDto
            {
                Success = false,
                Message = $"{route.Name} isn't closed for {closureDate:yyyy-MM-dd} — nothing to reopen."
            };
        }

        // ── GUARD 0: block reopening a closure from a PREVIOUS calendar day ──
        // Reopen() only flips the execution's Status back to InProgress — it never
        // touches ExecutionDate. So reopening a route closed on, say, 30-Jul while
        // it's now 31-Jul revives that SAME execution row still stamped with
        // ExecutionDate = 30-Jul. Every new visit/order the salesman then takes
        // inherits that stale date (CreateOrderCommandHandler stamps
        // OrderDate = execution.ExecutionDate), which is exactly how "today's"
        // orders end up showing as yesterday's. A new calendar day already means
        // a fresh cycle is available via the normal Take Orders flow — Reopen is
        // only meaningful for undoing a same-day closure mistake.
        if (closure.ClosureDate.Date != DateTime.UtcNow.Date)
        {
            return new ReopenRouteResultDto
            {
                Success = false,
                Message = $"{route.Name} was closed on {closure.ClosureDate:dd MMM yyyy}, not today. " +
                    "A new day already means a fresh cycle is available — just have the salesman tap " +
                    "Take Orders to start today's cycle instead of reopening yesterday's."
            };
        }

        // ── GUARD 1: block if the route has already been restarted ──
        // If a new InProgress execution exists, the salesman is already mid-way
        // through a fresh cycle; reopening the old closure now would collide
        // with it and corrupt state.
        var hasActiveExecution = await context.RouteExecutions
            .AnyAsync(e => !e.IsDeleted && e.RouteId == routeId && e.Status == ExecutionStatus.InProgress, cancellationToken);


        if (hasActiveExecution)
        {
            Console.WriteLine($"[ReopenRoute] Blocked: {route.Name} already has a new execution in progress.");
            return new ReopenRouteResultDto
            {
                Success = false,
                Message = $"{route.Name} has already started a new cycle since it was closed — it can't be reopened. Ask the salesman to close that new cycle first if this was a mistake."
            };
        }

        // ── BUG FIX: this used to grab every locked order with OrderDate <=
        // closureDate — meaning reopening THIS closure could also unlock orders
        // that were genuinely closed by an EARLIER, separate closure of the same
        // route days or weeks before. In practice: a customer's order from an
        // earlier properly-closed day would silently flip back to Draft, then
        // reappear in the salesman's "existing order for this customer" lookup
        // as if it were the current one — and cancelling what looked like a
        // fresh order could actually hard-delete that old, real historical
        // order permanently.
        //
        // Fix: bound the unlock window on BOTH sides — only orders dated after
        // the previous closure for this route (if any) through this closure
        // date are eligible. This still correctly handles a legitimately
        // lingering multi-day draft being swept up by a later close (the close
        // side's own `<=` is intentionally broad for that reason), but reopen
        // now only ever touches the specific batch THIS closure actually
        // locked — never anything an earlier, separate closure already handled. ──
        var previousClosureDate = await context.DailyClosures
            .Where(c => !c.IsDeleted
                && c.RouteId == routeId
                && c.ClosureDate.Date < closureDate.Date)
            .OrderByDescending(c => c.ClosureDate)
            .Select(c => (DateTime?)c.ClosureDate)
            .FirstOrDefaultAsync(cancellationToken);

        // The orders this closure locked — same filter used to lock them,
        // now bounded to exclude anything an earlier closure already covered.
        var ordersToUnlock = await context.Orders
            .Where(o => !o.IsDeleted
                && o.IsLocked
                && o.RouteId == routeId
                && o.OrderDate.Date <= closureDate.Date
                && (previousClosureDate == null || o.OrderDate.Date > previousClosureDate.Value.Date))
            .ToListAsync(cancellationToken);

        // ── GUARD 2: block if warehouse already started packing ──
        var alreadyPacking = ordersToUnlock.Any(o => o.PackingStatus != PackingStatus.Pending);
        if (alreadyPacking)
        {
            Console.WriteLine($"[ReopenRoute] Blocked: warehouse has already started packing for {route.Name}.");
            return new ReopenRouteResultDto
            {
                Success = false,
                Message = $"Warehouse has already started packing orders for {route.Name} — reopening now would desync the loading sheet from what's physically happening. Coordinate with warehouse before undoing this closure."
            };
        }

        // ── Unlock orders, revert the ones this closure flipped to Closed ──
        foreach (var order in ordersToUnlock)
        {
            order.IsLocked = false;
            order.ClosedAt = null;

            if (order.ClosedByRouteClosure)
            {
                order.Status = OrderStatus.Draft;
                order.ClosedByRouteClosure = false;
            }

            order.UpdateTimestamp(adminUserId.ToString());
        }
        Console.WriteLine($"[ReopenRoute] Unlocked {ordersToUnlock.Count} orders for {route.Name}");

        // ── Reopen the execution(s) this closure completed ──
        // BUG FIX: this used to require `e.ExecutionDate.Date == closureDate.Date`.
        // But CloseDayCommandHandler (which completes the execution when the route
        // is closed) has NO date filter at all — it just completes whatever is
        // currently InProgress for the route. ExecutionDate is stamped from
        // DateTime.UtcNow.Date when the salesman started the route, which can land
        // on a different calendar date than the admin's closureDate (UTC vs local
        // day rollover, or the route being closed some time after it was started).
        // When that happened, this query silently found nothing, the real
        // completed execution (with all its OrderPlaced visits) stayed Completed
        // forever, and the next time the salesman opened the route the app found
        // no active execution and started a BRAND NEW one — fresh Pending visits
        // for every stop, even though the underlying orders (and their items)
        // were still sitting there untouched. "Take Order" showed instead of
        // "View Order" because the salesman was really looking at a new,
        // unrelated execution, not the one that was just reopened.
        //
        // Fix: mirror CloseDayCommandHandler's own logic — reopen the most
        // recently-completed execution for this route per ExecutionType (order
        // taking and delivery are tracked separately), with no date constraint.
        // A route only ever has one outstanding "needs reopen" cycle per type at
        // a time, so grabbing the latest Completed one per type is always correct.
        var completedExecutions = await context.RouteExecutions
            .Where(e => !e.IsDeleted
                && e.RouteId == routeId
                && e.Status == ExecutionStatus.Completed)
            .ToListAsync(cancellationToken);

        var executionsToReopen = completedExecutions
            .GroupBy(e => e.ExecutionType)
            .Select(g => g.OrderByDescending(e => e.CompletedAt).First())
            .ToList();

        foreach (var execution in executionsToReopen)
        {
            execution.Reopen();
        }
        Console.WriteLine($"[ReopenRoute] Reopened {executionsToReopen.Count} execution(s) for {route.Name}");

        // ── Deactivate the closure record — route now shows as open again ──
        closure.IsActive = false;
        closure.Notes = string.IsNullOrWhiteSpace(closure.Notes)
            ? $"Reopened by admin on {DateTime.UtcNow:yyyy-MM-dd HH:mm}"
            : $"{closure.Notes}\n[Reopened by admin on {DateTime.UtcNow:yyyy-MM-dd HH:mm}]";

        await context.SaveChangesAsync(cancellationToken);

        Console.WriteLine($"[ReopenRoute] {route.Name} reopened successfully!");
        Console.WriteLine($"[ReopenRoute] ========================================");

        return new ReopenRouteResultDto
        {
            Success = true,
            Message = $"{route.Name} reopened. Orders are unlocked and the route is back in progress.",
            OrdersUnlocked = ordersToUnlock.Count,
            ExecutionsReopened = executionsToReopen.Count,
        };
    }
}