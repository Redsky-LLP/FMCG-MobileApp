using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Analytics.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetProductPerformanceQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetProductPerformanceQuery, Result<ProductPerformanceResponseDto>>
{
    public async Task<Result<ProductPerformanceResponseDto>> Handle(GetProductPerformanceQuery request, CancellationToken cancellationToken)
    {
        var fromDate = (request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30)).ToUniversalTime();
        var toDate = (request.ToDate ?? DateTime.UtcNow.Date).ToUniversalTime();
        var limit = request.Limit ?? 50;
        var sortBy = request.SortBy ?? "sales";

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
            return Result<ProductPerformanceResponseDto>.Success(new ProductPerformanceResponseDto
            {
                Products = new List<ProductPerformanceDto>(),
                Summary = new ProductPerformanceSummaryDto(),
                FromDate = fromDate,
                ToDate = toDate,
                GeneratedAt = DateTime.UtcNow
            });
        }

        // Build order items query
        var orderItemsQuery = context.OrderItems
            .Include(i => i.Product!)
                .ThenInclude(p => p!.ProductGroup)
            .Include(i => i.Unit)
            .Where(i => orderIds.Contains(i.OrderId) && !i.IsDeleted);

        if (request.ProductGroupId.HasValue)
        {
            orderItemsQuery = orderItemsQuery.Where(i => i.Product != null && i.Product.ProductGroupId == request.ProductGroupId.Value);
        }

        var orderItems = await orderItemsQuery.ToListAsync(cancellationToken);

        if (orderItems.Count == 0)
        {
            return Result<ProductPerformanceResponseDto>.Success(new ProductPerformanceResponseDto
            {
                Products = new List<ProductPerformanceDto>(),
                Summary = new ProductPerformanceSummaryDto(),
                FromDate = fromDate,
                ToDate = toDate,
                GeneratedAt = DateTime.UtcNow
            });
        }

        // Group by product
        var productPerformances = orderItems
            .GroupBy(i => new
            {
                i.ProductId,
                i.Product!.NameEnglish,
                i.Product.NameMalayalam,
                i.Product!.ProductGroup!.Name,
                i.Unit!.Symbol
            })
            .Select(g => new ProductPerformanceDto
            {
                ProductId = g.Key.ProductId,
                ProductName = g.Key.NameEnglish,
                ProductNameMalayalam = g.Key.NameMalayalam,
                ProductGroupName = g.Key.Name,
                UnitSymbol = g.Key.Symbol,
                TotalQuantity = g.Sum(i => i.Quantity),
                TotalSales = g.Sum(i => i.SellingPrice * i.Quantity),
                TotalVariance = g.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity),
                OrderCount = g.Select(i => i.OrderId).Distinct().Count(),
                AveragePrice = g.Average(i => i.SellingPrice)
            })
            .ToList();

        // Calculate margin percentages
        foreach (var product in productPerformances)
        {
            if (product.TotalSales > 0)
            {
                product.MarginPercentage = (product.TotalVariance / product.TotalSales) * 100;
            }
        }

        // Apply sorting
        productPerformances = sortBy.ToLower() switch
        {
            "margin" => [.. productPerformances.OrderByDescending(p => p.MarginPercentage)],
            "quantity" => [.. productPerformances.OrderByDescending(p => p.TotalQuantity)],
            _ => [.. productPerformances.OrderByDescending(p => p.TotalSales)]
        };

        // Apply limit
        if (limit > 0 && productPerformances.Count > limit)
        {
            productPerformances = productPerformances.Take(limit).ToList();
        }

        // Calculate summary
        var totalSales = productPerformances.Sum(p => p.TotalSales);
        var totalVariance = productPerformances.Sum(p => p.TotalVariance);
        var totalMarginPercentage = totalSales > 0 ? (totalVariance / totalSales) * 100 : 0;

        var result = new ProductPerformanceResponseDto
        {
            Products = productPerformances,
            Summary = new ProductPerformanceSummaryDto
            {
                TotalSales = totalSales,
                TotalVariance = totalVariance,
                MarginPercentage = totalMarginPercentage,
                TotalProducts = productPerformances.Count,
                TotalOrders = orderItems.Select(i => i.OrderId).Distinct().Count()
            },
            FromDate = fromDate,
            ToDate = toDate,
            GeneratedAt = DateTime.UtcNow
        };

        return Result<ProductPerformanceResponseDto>.Success(result);
    }
}