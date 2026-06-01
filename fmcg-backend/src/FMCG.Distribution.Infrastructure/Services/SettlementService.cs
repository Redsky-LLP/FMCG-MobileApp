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

        // Check for any draft orders
        var draftOrdersQuery = context.Orders
            .Where(o => !o.IsDeleted && o.Status == OrderStatus.Draft);

        if (routeId.HasValue)
        {
            draftOrdersQuery = draftOrdersQuery.Where(o => o.RouteId == routeId.Value);
        }

        var draftOrderCount = await draftOrdersQuery.CountAsync(cancellationToken);
        if (draftOrderCount > 0)
        {
            errors.Add($"Cannot close day: {draftOrderCount} draft order(s) need to be submitted.");
        }

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
        var ordersToLock = await context.Orders
            .Include(o => o.Items)
            .Where(o => !o.IsDeleted
                && o.Status != OrderStatus.Draft
                && !o.IsLocked
                && o.OrderDate <= closureDate)
            .ToListAsync(cancellationToken);

        // Lock each order
        foreach (var order in ordersToLock)
        {
            order.IsLocked = true;
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
            Message = $"Operational day closed successfully. Expected cash: {closure.ExpectedCash:C}",
            LoadingSheetUrl = loadingUrl,
            BillingSheetUrl = billingUrl,
        };
    }
}