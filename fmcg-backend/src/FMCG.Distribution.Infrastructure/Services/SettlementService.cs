using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Settlement.DTOs;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Features.Reports.Queries;

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
        // Requiring zero drafts to ever close the day would mean the day can
        // never close as long as a single never-actioned draft exists
        // anywhere in the system — which defeats the point of Close Day.

        // Check if day is already closed
        var existingClosure = await context.DailyClosures
            .FirstOrDefaultAsync(c => !c.IsDeleted && c.ClosureDate.Date == targetDate.Date, cancellationToken);

        if (existingClosure != null)
        {
            errors.Add($"Day {targetDate:yyyy-MM-dd} is already closed.");
        }

        // Calculate settlement summary
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

    public async Task<DailyClosureResultDto> CloseOperationalDayAsync(Guid closedByUserId, DateTime closureDate, string? notes, CancellationToken cancellationToken = default)
    {
        // Validate before closing
        var validation = await ValidateSettlementBeforeClosureAsync(null, closureDate, cancellationToken);

        if (!validation.IsValid)
        {
            return new DailyClosureResultDto
            {
                Success = false,
                Message = string.Join("; ", validation.ValidationErrors)
            };
        }

        // Get all submitted orders for locking
        // Get ALL orders for locking — Draft included. Once admin closes the
        // day, nothing related to it stays editable, full stop. A Draft that
        // never got submitted in time is now admin's problem to resolve
        // through other means (cancel it, or handle the customer manually) —
        // it does not get a free pass to stay open indefinitely.
        var ordersToLock = await context.Orders
            .Include(o => o.Items)
            .Where(o => !o.IsDeleted
                && !o.IsLocked
                && o.OrderDate <= closureDate)
            .ToListAsync(cancellationToken);

        // Still informational for the closure message — admin should know
        // how many of the orders just locked were never actually submitted.
        var draftCountAsOfClosure = ordersToLock.Count(o => o.Status == OrderStatus.Draft);

        // Lock each order
        // Lock each order — and record exactly when, so admin can see it later
        // even though the order's own OrderDate stays whatever day it was
        // actually created on (could be a day or two before this closure ran).
        var closureTimestamp = DateTime.UtcNow;
        foreach (var order in ordersToLock)
        {
            order.IsLocked = true;
            order.ClosedAt = closureTimestamp;
            order.UpdateTimestamp(closedByUserId.ToString());
        }

        // Create daily closure record
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
            Notes = notes
        };

        await context.DailyClosures.AddAsync(closure, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        // ── Also close every open route execution ───────────────────────────
        // Without this, the settlement closure above locks orders and creates
        // the DailyClosure record, but route execution status never changes —
        // so order-taking routes would stay stuck at "in progress" forever and
        // never go back to a fresh, startable state for the next day. This is
        // what actually makes route cards reset.
        // Non-blocking: if this fails for any reason, the settlement closure
        // itself has already succeeded and should not be rolled back over it.
        int closedRouteCount = 0;
        try
        {
            var closeDayResult = await mediator.Send(
                new FMCG.Distribution.Application.Features.Routes.Commands.CloseDayCommand
                {
                    AdminUserId = closedByUserId,
                },
                cancellationToken);

            if (closeDayResult.IsSuccess && closeDayResult.Data != null)
            {
                closedRouteCount = closeDayResult.Data.ClosedRouteCount;
            }
        }
        catch { /* swallow — settlement closure itself already succeeded */ }

        // ── Auto-generate reports post-closure ────────────────────────────────
        // Non-blocking: report failures do not roll back the closure.
        string? loadingUrl = null;
        string? billingUrl = null;

        try
        {
            var loadingResult = await mediator.Send(
                new GetLoadingSheetQuery { Date = closureDate },
                cancellationToken);

            if (loadingResult.IsSuccess && loadingResult.Data != null)
            {
                // Store bytes in a temp location; return a relative download URL.
                // The Reports controller already exposes GET /api/v1/reports/loading-sheet
                // with ?date= and ?routeId= params — point frontend there directly.
                loadingUrl = $"/api/v1/reports/loading-sheet?date={closureDate:yyyy-MM-dd}";
            }
        }
        catch { /* swallow — report is non-critical */ }

        try
        {
            var billingResult = await mediator.Send(
                new GetBillingSheetQuery { Date = closureDate },
                cancellationToken);

            if (billingResult.IsSuccess && billingResult.Data != null)
            {
                billingUrl = $"/api/v1/reports/billing-sheet?date={closureDate:yyyy-MM-dd}";
            }
        }
        catch { /* swallow — report is non-critical */ }
        // ─────────────────────────────────────────────────────────────────────

        return new DailyClosureResultDto
        {
            ClosureId = closure.Id,
            ClosureDate = closure.ClosureDate,
            ClosedAt = closure.ClosedAt,
            TotalSales = closure.TotalSales,
            TotalOutstanding = closure.TotalOutstanding,
            ExpectedCash = closure.ExpectedCash,
            Success = true,
            Message = BuildClosureMessage(closure.ExpectedCash, closedRouteCount, draftCountAsOfClosure),
            LoadingSheetUrl = loadingUrl,
            BillingSheetUrl = billingUrl,
            ClosedRouteCount = closedRouteCount,
        };
    }

    private static string BuildClosureMessage(decimal expectedCash, int closedRouteCount, int draftCount)
    {
        var parts = new List<string> { $"Operational day closed successfully. Expected cash: {expectedCash:C}." };
        if (closedRouteCount > 0)
            parts.Add($"{closedRouteCount} route(s) closed and ready fresh tomorrow.");
        if (draftCount > 0)
            parts.Add($"Note: {draftCount} draft order(s) were never submitted and are now locked along with everything else — review them manually if needed.");
        return string.Join(" ", parts);
    }
}