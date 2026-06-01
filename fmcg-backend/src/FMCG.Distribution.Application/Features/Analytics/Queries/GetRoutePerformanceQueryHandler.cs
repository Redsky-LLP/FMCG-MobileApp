using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Analytics.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetRoutePerformanceQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetRoutePerformanceQuery, Result<RoutePerformanceResponseDto>>
{
    public async Task<Result<RoutePerformanceResponseDto>> Handle(GetRoutePerformanceQuery request, CancellationToken cancellationToken)
    {
        var fromDate = (request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30)).ToUniversalTime();
        var toDate = (request.ToDate ?? DateTime.UtcNow.Date).ToUniversalTime();

        // Build orders query
        var ordersQuery = context.Orders
            .Include(o => o.Route)
            .Include(o => o.Items!)
            .Include(o => o.Customer)
            .Where(o => !o.IsDeleted
                && o.Status != OrderStatus.Draft
                && o.OrderDate.Date >= fromDate.Date
                && o.OrderDate.Date <= toDate.Date);

        if (request.RouteId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.RouteId == request.RouteId.Value);
        }

        var orders = await ordersQuery.ToListAsync(cancellationToken);

        if (orders.Count == 0)
        {
            return Result<RoutePerformanceResponseDto>.Success(new RoutePerformanceResponseDto
            {
                Routes = [],
                Overall = new RoutePerformanceSummaryDto(),
                FromDate = fromDate,
                ToDate = toDate,
                GeneratedAt = DateTime.UtcNow
            });
        }

        // Get unique route IDs from orders
        var routeIds = orders.Select(o => o.RouteId).Distinct();

        // Get customer count per route
        var customerCounts = await context.Customers
            .Where(c => routeIds.Contains(c.RouteId) && !c.IsDeleted)
            .GroupBy(c => c.RouteId)
            .Select(g => new { RouteId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RouteId, x => x.Count, cancellationToken);

        // Get salesman count per route
        var salesmanCounts = await context.Routes
            .Where(r => routeIds.Contains(r.Id) && !r.IsDeleted && r.AssignedSalesmanId.HasValue)
            .GroupBy(r => r.Id)
            .Select(g => new { RouteId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RouteId, x => x.Count, cancellationToken);

        // Group by route
        var routePerformances = orders
            .GroupBy(o => new { o.RouteId, o.Route!.Name })
            .Select(g => new RoutePerformanceDto
            {
                RouteId = g.Key.RouteId,
                RouteName = g.Key.Name,
                OrderCount = g.Count(),
                TotalQuantity = g.SelectMany(o => o.Items!).Sum(i => i.Quantity),
                TotalSales = g.SelectMany(o => o.Items!).Sum(i => i.SellingPrice * i.Quantity),
                TotalVariance = g.SelectMany(o => o.Items!).Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity),
                ActiveCustomerCount = customerCounts.GetValueOrDefault(g.Key.RouteId, 0),
                SalesmanCount = salesmanCounts.GetValueOrDefault(g.Key.RouteId, 0)
            })
            .OrderByDescending(r => r.TotalSales)
            .ToList();

        // Calculate margin percentages
        foreach (var route in routePerformances)
        {
            if (route.TotalSales > 0)
            {
                route.MarginPercentage = (route.TotalVariance / route.TotalSales) * 100;
            }
        }

        // Calculate overall summary
        var overallSales = routePerformances.Sum(r => r.TotalSales);
        var overallVariance = routePerformances.Sum(r => r.TotalVariance);
        var overallMarginPercentage = overallSales > 0 ? (overallVariance / overallSales) * 100 : 0;

        var result = new RoutePerformanceResponseDto
        {
            Routes = routePerformances,
            Overall = new RoutePerformanceSummaryDto
            {
                TotalSales = overallSales,
                TotalVariance = overallVariance,
                MarginPercentage = overallMarginPercentage,
                TotalOrders = orders.Count,
                TotalRoutes = routePerformances.Count
            },
            FromDate = fromDate,
            ToDate = toDate,
            GeneratedAt = DateTime.UtcNow
        };

        return Result<RoutePerformanceResponseDto>.Success(result);
    }
}