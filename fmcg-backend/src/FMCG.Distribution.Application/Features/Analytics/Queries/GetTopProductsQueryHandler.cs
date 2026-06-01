using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Analytics.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetTopProductsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetTopProductsQuery, Result<List<TopProductDto>>>
{
    public async Task<Result<List<TopProductDto>>> Handle(GetTopProductsQuery request, CancellationToken cancellationToken)
    {
        var fromDate = request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var toDate = request.ToDate ?? DateTime.UtcNow.Date;

        // Get order IDs within date range
        var orderIds = await context.Orders
            .Where(o => !o.IsDeleted
                && o.Status != OrderStatus.Draft
                && o.OrderDate.Date >= fromDate.Date
                && o.OrderDate.Date <= toDate.Date)
            .Select(o => o.Id)
            .ToListAsync(cancellationToken);

        if (orderIds.Count == 0)
        {
            return Result<List<TopProductDto>>.Success(new List<TopProductDto>());
        }

        // Build order items query
        var orderItemsQuery = context.OrderItems
            .Include(i => i.Product)
            .Where(i => orderIds.Contains(i.OrderId) && !i.IsDeleted);

        if (request.ProductGroupId.HasValue)
        {
            orderItemsQuery = orderItemsQuery.Where(i => i.Product != null && i.Product.ProductGroupId == request.ProductGroupId.Value);
        }

        var orderItems = await orderItemsQuery.ToListAsync(cancellationToken);

        // Group by product
        var products = orderItems
            .GroupBy(i => new { i.ProductId, i.Product!.NameEnglish, i.Product.NameMalayalam })
            .Select(g => new TopProductDto
            {
                ProductId = g.Key.ProductId,
                ProductName = g.Key.NameEnglish,
                ProductNameMalayalam = g.Key.NameMalayalam,
                TotalQuantity = g.Sum(i => i.Quantity),
                TotalSales = g.Sum(i => i.SellingPrice * i.Quantity),
                TotalVariance = g.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity),
                OrderCount = g.Select(i => i.OrderId).Distinct().Count()
            })
            .ToList();

        // Apply sorting
        products = request.SortBy.ToLower() switch
        {
            "margin" => [.. products.OrderByDescending(p => p.TotalVariance)],
            "quantity" => [.. products.OrderByDescending(p => p.TotalQuantity)],
            _ => [.. products.OrderByDescending(p => p.TotalSales)]
        };

        // Apply limit
        if (request.Limit > 0 && products.Count > request.Limit)
        {
            products = products.Take(request.Limit).ToList();
        }

        return Result<List<TopProductDto>>.Success(products);
    }
}