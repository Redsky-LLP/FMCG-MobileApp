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
        // ── DEBUG LOGGING ──
        Console.WriteLine($"[CloseDay] ========================================");
        Console.WriteLine($"[CloseDay] Closing for date: {closureDate}");
        Console.WriteLine($"[CloseDay] ClosedByUserId: {closedByUserId}");
        Console.WriteLine($"[CloseDay] ========================================");

        // Validate before closing
        var validation = await ValidateSettlementBeforeClosureAsync(null, closureDate, cancellationToken);

        if (!validation.IsValid)
        {
            Console.WriteLine($"[CloseDay] Validation failed: {string.Join("; ", validation.ValidationErrors)}");
            return new DailyClosureResultDto
            {
                Success = false,
                Message = string.Join("; ", validation.ValidationErrors)
            };
        }

        // ── FIX 1: Compare only DATE part, not full timestamp ──
        // This ensures orders created TODAY and closed TODAY are also locked.
        var ordersToLock = await context.Orders
            .Include(o => o.Items)
            .Where(o => !o.IsDeleted
                && !o.IsLocked
                && o.OrderDate.Date <= closureDate.Date)  // ← FIXED: Compare only Date!
            .ToListAsync(cancellationToken);

        Console.WriteLine($"[CloseDay] Found {ordersToLock.Count} orders to lock");
        foreach (var order in ordersToLock)
        {
            Console.WriteLine($"  - Order {order.OrderNumber}: Status={order.Status}, OrderDate={order.OrderDate}, IsLocked={order.IsLocked}");
        }

        if (ordersToLock.Count == 0)
        {
            Console.WriteLine($"[CloseDay] ⚠️ WARNING: No orders found to lock!");
        }

        var draftCountAsOfClosure = ordersToLock.Count(o => o.Status == OrderStatus.Draft);

        // ── FIX 2: Lock each order AND change status from Draft to Closed ──
        var closureTimestamp = DateTime.UtcNow;
        foreach (var order in ordersToLock)
        {
            order.IsLocked = true;
            order.ClosedAt = closureTimestamp;

            // ── NEW: Change Draft status to Closed ──
            if (order.Status == OrderStatus.Draft)
            {
                order.Status = OrderStatus.Closed;
            }

            order.UpdateTimestamp(closedByUserId.ToString());
        }

        Console.WriteLine($"[CloseDay] Locked {ordersToLock.Count} orders at {closureTimestamp}");
        Console.WriteLine($"[CloseDay] Changed {draftCountAsOfClosure} orders from Draft to Closed");

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

        Console.WriteLine($"[CloseDay] DailyClosure record saved with ID: {closure.Id}");

        // ── Also close every open route execution ──
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
                Console.WriteLine($"[CloseDay] Closed {closedRouteCount} route executions");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CloseDay] Error closing routes: {ex.Message}");
        }

        // ── Auto-generate reports post-closure ──
        string? loadingUrl = null;
        string? billingUrl = null;

        try
        {
            var loadingResult = await mediator.Send(
                new GetLoadingSheetQuery { Date = closureDate },
                cancellationToken);

            if (loadingResult.IsSuccess && loadingResult.Data != null)
            {
                loadingUrl = $"/api/v1/reports/loading-sheet?date={closureDate:yyyy-MM-dd}";
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CloseDay] Error generating loading sheet: {ex.Message}");
        }

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
        catch (Exception ex)
        {
            Console.WriteLine($"[CloseDay] Error generating billing sheet: {ex.Message}");
        }

        Console.WriteLine($"[CloseDay] ========================================");
        Console.WriteLine($"[CloseDay] CloseDay completed successfully!");
        Console.WriteLine($"[CloseDay] ========================================");

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