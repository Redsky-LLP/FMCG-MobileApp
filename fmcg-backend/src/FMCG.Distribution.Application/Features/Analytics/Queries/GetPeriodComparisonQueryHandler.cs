#pragma warning disable CS9236

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Analytics.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetPeriodComparisonQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetPeriodComparisonQuery, Result<PeriodComparisonResponseDto>>
{
    public async Task<Result<PeriodComparisonResponseDto>> Handle(GetPeriodComparisonQuery request, CancellationToken cancellationToken)
    {
        var fromDate = request.FromDate.ToUniversalTime();
        var toDate = request.ToDate.ToUniversalTime();

        // Validate date range
        if (fromDate > toDate)
        {
            return Result<PeriodComparisonResponseDto>.Failure("From date must be earlier than or equal to To date.");
        }

        // Calculate period length in days
        var periodDays = (toDate - fromDate).Days + 1;

        // Calculate previous period dates
        var previousFromDate = fromDate.AddDays(-periodDays);
        var previousToDate = toDate.AddDays(-periodDays);

        // Build base query
        var baseQuery = context.Orders
            .Include(o => o.Items!)
            .Include(o => o.Customer)
            .Include(o => o.Route)
            .Where(o => !o.IsDeleted && o.Status != OrderStatus.Draft);

        if (request.RouteId.HasValue)
        {
            baseQuery = baseQuery.Where(o => o.RouteId == request.RouteId.Value);
        }

        // Get current period data
        var currentOrders = await baseQuery
            .Where(o => o.OrderDate.Date >= fromDate.Date && o.OrderDate.Date <= toDate.Date)
            .ToListAsync(cancellationToken);

        // Get customer and route counts for current period
        var currentCustomerIds = currentOrders.Select(o => o.CustomerId).Distinct();
        var currentRouteIds = currentOrders.Select(o => o.RouteId).Distinct();

        var currentPeriod = new PeriodDataDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            TotalSales = currentOrders.Sum(o => o.Items!.Sum(i => i.SellingPrice * i.Quantity)),
            TotalVariance = currentOrders.Sum(o => o.Items!.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity)),
            OrderCount = currentOrders.Count,
            CustomerCount = currentCustomerIds.Count(),
            RouteCount = currentRouteIds.Count()
        };

        currentPeriod.MarginPercentage = currentPeriod.TotalSales > 0
            ? (currentPeriod.TotalVariance / currentPeriod.TotalSales) * 100
            : 0;

        PeriodDataDto? previousPeriod = null;
        var comparison = new ComparisonSummaryDto();

        if (request.CompareWithPrevious)
        {
            // Get previous period data
            var previousOrders = await baseQuery
                .Where(o => o.OrderDate.Date >= previousFromDate.Date && o.OrderDate.Date <= previousToDate.Date)
                .ToListAsync(cancellationToken);

            var previousCustomerIds = previousOrders.Select(o => o.CustomerId).Distinct();
            var previousRouteIds = previousOrders.Select(o => o.RouteId).Distinct();

            previousPeriod = new PeriodDataDto
            {
                FromDate = previousFromDate,
                ToDate = previousToDate,
                TotalSales = previousOrders.Sum(o => o.Items!.Sum(i => i.SellingPrice * i.Quantity)),
                TotalVariance = previousOrders.Sum(o => o.Items!.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity)),
                OrderCount = previousOrders.Count,
                CustomerCount = previousCustomerIds.Count(),
                RouteCount = previousRouteIds.Count()
            };

            previousPeriod.MarginPercentage = previousPeriod.TotalSales > 0
                ? (previousPeriod.TotalVariance / previousPeriod.TotalSales) * 100
                : 0;

            // Calculate comparisons
            comparison.SalesChange = currentPeriod.TotalSales - previousPeriod.TotalSales;
            comparison.SalesChangePercentage = previousPeriod.TotalSales > 0
                ? (comparison.SalesChange / previousPeriod.TotalSales) * 100
                : 0;
            comparison.MarginChange = currentPeriod.MarginPercentage - previousPeriod.MarginPercentage;
            comparison.OrderCountChange = currentPeriod.OrderCount - previousPeriod.OrderCount;

            // Determine trend
            if (comparison.SalesChangePercentage > 5 && comparison.MarginChange > -2)
            {
                comparison.Trend = "improving";
            }
            else if (comparison.SalesChangePercentage < -5)
            {
                comparison.Trend = "declining";
            }
            else
            {
                comparison.Trend = "stable";
            }
        }

        var result = new PeriodComparisonResponseDto
        {
            CurrentPeriod = currentPeriod,
            PreviousPeriod = previousPeriod,
            Comparison = comparison,
            GeneratedAt = DateTime.UtcNow
        };

        return Result<PeriodComparisonResponseDto>.Success(result);
    }
}

#pragma warning restore CS9236