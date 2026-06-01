// PATH: src/FMCG.Distribution.Application/Features/Analytics/Queries/GetProductProfitabilityQueryHandler.cs
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

public class GetProductProfitabilityQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetProductProfitabilityQuery, Result<List<ProductProfitabilityDto>>>
{
    public async Task<Result<List<ProductProfitabilityDto>>> Handle(
        GetProductProfitabilityQuery request, CancellationToken cancellationToken)
    {
        // ── FIXED: was (Submitted || Closed) — Submitted no longer exists ─────
        // Include all orders that have moved past the Draft stage.
        var ordersQuery = context.Orders
            .Where(o => !o.IsDeleted && o.Status != OrderStatus.Draft);

        if (request.FromDate.HasValue)
            ordersQuery = ordersQuery.Where(o => o.OrderDate >= request.FromDate.Value.ToUniversalTime());

        if (request.ToDate.HasValue)
            ordersQuery = ordersQuery.Where(o => o.OrderDate <= request.ToDate.Value.ToUniversalTime());

        var orderIds = await ordersQuery.Select(o => o.Id).ToListAsync(cancellationToken);

        var orderItemsQuery = context.OrderItems
            .Include(oi => oi.Product)
            .ThenInclude(p => p!.ProductGroup)
            .Where(oi => orderIds.Contains(oi.OrderId) && !oi.IsDeleted);

        var productProfitability = await orderItemsQuery
            .GroupBy(oi => new
            {
                oi.ProductId,
                oi.Product!.NameEnglish,
                oi.Product.NameMalayalam,
                oi.Product!.ProductGroupId,
                oi.Product!.ProductGroup!.Name,
            })
            .Select(g => new ProductProfitabilityDto
            {
                ProductId = g.Key.ProductId,
                ProductName = g.Key.NameEnglish,
                ProductNameMalayalam = g.Key.NameMalayalam,
                ProductGroupId = g.Key.ProductGroupId,
                ProductGroupName = g.Key.Name,
                TotalQuantity = g.Sum(oi => oi.Quantity),
                TotalSales = g.Sum(oi => oi.SellingPrice * oi.Quantity),
                TotalVariance = g.Sum(oi => (oi.SellingPrice - oi.BasePriceAtTime) * oi.Quantity),
                OrderCount = g.Select(oi => oi.OrderId).Distinct().Count(),
            })
            .ToListAsync(cancellationToken);

        foreach (var item in productProfitability)
        {
            if (item.TotalSales > 0)
                item.MarginPercentage = (item.TotalVariance / item.TotalSales) * 100;
        }

        if (request.ShowOnlyNegativeMargin == true)
            productProfitability = productProfitability.Where(p => p.TotalVariance < 0).ToList();

        if (request.ProductGroupId.HasValue)
            productProfitability = productProfitability.Where(p => p.ProductGroupId == request.ProductGroupId.Value).ToList();

        productProfitability = productProfitability.OrderBy(p => p.TotalVariance).ToList();

        return Result<List<ProductProfitabilityDto>>.Success(productProfitability);
    }
}