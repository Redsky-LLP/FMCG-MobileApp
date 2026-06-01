// PATH: src/FMCG.Distribution.Application/Features/Analytics/Queries/GetRouteProfitabilityQueryHandler.cs
// FIXED: OrderStatus.Submitted no longer exists.
//        Analytics should include all orders that have passed the Draft stage
//        (PendingApproval, Approved, Packed, Closed).
//        Using o.Status != OrderStatus.Draft is the cleanest equivalent.

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetRouteProfitabilityQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetRouteProfitabilityQuery, Result<List<RouteProfitabilityDto>>>
{
    public async Task<Result<List<RouteProfitabilityDto>>> Handle(
        GetRouteProfitabilityQuery request, CancellationToken cancellationToken)
    {
        // ── FIXED: was (Submitted || Closed) — Submitted no longer exists ─────
        // Include all orders that have moved past the Draft stage.
        var ordersQuery = context.Orders
            .Include(o => o.Route)
            .Include(o => o.Items)
            .Where(o => !o.IsDeleted && o.Status != OrderStatus.Draft);

        if (request.FromDate.HasValue)
            ordersQuery = ordersQuery.Where(o => o.OrderDate >= request.FromDate.Value.ToUniversalTime());

        if (request.ToDate.HasValue)
            ordersQuery = ordersQuery.Where(o => o.OrderDate <= request.ToDate.Value.ToUniversalTime());

        if (request.RouteId.HasValue)
            ordersQuery = ordersQuery.Where(o => o.RouteId == request.RouteId.Value);

        var orders = await ordersQuery.ToListAsync(cancellationToken);

        var routeProfitability = orders
            .GroupBy(o => new { o.RouteId, o.Route!.Name })
            .Select(g => new RouteProfitabilityDto
            {
                RouteId = g.Key.RouteId,
                RouteName = g.Key.Name,
                TotalSales = g.Sum(o => o.Items!.Sum(i => i.SellingPrice * i.Quantity)),
                TotalVariance = g.Sum(o => o.Items!.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity)),
                OrderCount = g.Count(),
                CustomerCount = g.Select(o => o.CustomerId).Distinct().Count(),
            })
            .ToList();

        foreach (var item in routeProfitability)
        {
            if (item.TotalSales > 0)
                item.MarginPercentage = (item.TotalVariance / item.TotalSales) * 100;
        }

        if (request.ShowOnlyNegativeMargin == true)
            routeProfitability = routeProfitability.Where(r => r.TotalVariance < 0).ToList();

        routeProfitability = routeProfitability.OrderBy(r => r.TotalVariance).ToList();

        return Result<List<RouteProfitabilityDto>>.Success(routeProfitability);
    }
}