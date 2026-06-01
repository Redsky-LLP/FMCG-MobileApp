#pragma warning disable CS9236

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Analytics.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetDashboardKpisQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetDashboardKpisQuery, Result<DashboardKpisDto>>
{
    public async Task<Result<DashboardKpisDto>> Handle(GetDashboardKpisQuery request, CancellationToken cancellationToken)
    {
        var targetDate = (request.Date ?? DateTime.UtcNow.Date).ToUniversalTime();
        var previousDate = targetDate.AddDays(-1);

        // Get orders for current period - with null-safe access
        var currentOrders = await context.Orders
            .Include(o => o.Items!)
            .Where(o => !o.IsDeleted
                && o.Status != OrderStatus.Draft
                && o.OrderDate.Date == targetDate.Date)
            .ToListAsync(cancellationToken);

        // Get orders for previous period - with null-safe access
        var previousOrders = await context.Orders
            .Include(o => o.Items!)
            .Where(o => !o.IsDeleted
                && o.Status != OrderStatus.Draft
                && o.OrderDate.Date == previousDate.Date)
            .ToListAsync(cancellationToken);

        // Calculate current period metrics with null checks
        var currentSales = currentOrders.Sum(o => o.Items?.Sum(i => i.SellingPrice * i.Quantity) ?? 0);
        var currentOrderCount = currentOrders.Count;
        var currentAvgOrderValue = currentOrderCount > 0 ? currentSales / currentOrderCount : 0;
        var currentVariance = currentOrders.Sum(o => o.Items?.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity) ?? 0);
        var currentMarginPercentage = currentSales > 0 ? (currentVariance / currentSales) * 100 : 0;

        // Calculate previous period metrics for trends
        var previousSales = previousOrders.Sum(o => o.Items?.Sum(i => i.SellingPrice * i.Quantity) ?? 0);
        var previousOrderCount = previousOrders.Count;

        // Get outstanding amount
        var outstanding = await context.Outstandings
            .Where(o => !o.IsDeleted && o.SettlementStatus != SettlementStatus.Settled)
            .SumAsync(o => o.OutstandingAmount, cancellationToken);

        // Get top products - with null checks
        var topProducts = currentOrders
            .Where(o => o.Items != null && o.Items.Any())
            .SelectMany(o => o.Items!)
            .Where(i => i.Product != null)
            .GroupBy(i => new { i.ProductId, i.Product!.NameEnglish, i.Product.NameMalayalam })
            .Select(g => new TopProductDto
            {
                ProductId = g.Key.ProductId,
                ProductName = g.Key.NameEnglish ?? string.Empty,
                ProductNameMalayalam = g.Key.NameMalayalam,
                TotalQuantity = g.Sum(i => i.Quantity),
                TotalSales = g.Sum(i => i.SellingPrice * i.Quantity),
                TotalVariance = g.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity),
                OrderCount = g.Select(i => i.OrderId).Distinct().Count()
            })
            .OrderByDescending(p => p.TotalSales)
            .Take(5)
            .ToList();

        // Get route performance - with null checks
        var routePerformance = currentOrders
            .Where(o => o.Route != null && o.Items != null && o.Items.Any())
            .GroupBy(o => new { o.RouteId, o.Route!.Name })
            .Select(g => new RoutePerformanceSummaryDto
            {
                TotalSales = g.Sum(o => o.Items?.Sum(i => i.SellingPrice * i.Quantity) ?? 0),
                TotalVariance = g.Sum(o => o.Items?.Sum(i => (i.SellingPrice - i.BasePriceAtTime) * i.Quantity) ?? 0),
                TotalOrders = g.Count()
            })
            .ToList();

        // Get top salesmen by incentive - with null checks
        var salesmanPerformance = currentOrders
            .Where(o => o.Salesman != null && o.Items != null && o.Items.Any())
            .GroupBy(o => new { o.SalesmanId, o.Salesman!.FullName })
            .Select(g => new SalesmanIncentiveSummaryDto
            {
                SalesmanId = g.Key.SalesmanId,
                SalesmanName = g.Key.FullName ?? string.Empty,
                TotalSales = g.Sum(o => o.Items?.Sum(i => i.SellingPrice * i.Quantity) ?? 0),
                OrderCount = g.Count()
            })
            .OrderByDescending(s => s.TotalSales)
            .Take(5)
            .ToList();

        // Calculate trends
        var salesChange = previousSales > 0 ? ((currentSales - previousSales) / previousSales) * 100 : 0;
        var ordersChange = previousOrderCount > 0 ? ((currentOrderCount - previousOrderCount) / (decimal)previousOrderCount) * 100 : 0;

        var result = new DashboardKpisDto
        {
            TotalSales = new KpiCardDto
            {
                Label = "Total Sales",
                Value = currentSales,
                Format = "currency",
                Change = salesChange,
                Trend = salesChange > 0 ? "up" : salesChange < 0 ? "down" : "stable"
            },
            TotalOrders = new KpiCardDto
            {
                Label = "Total Orders",
                Value = currentOrderCount,
                Format = "number",
                Change = ordersChange,
                Trend = ordersChange > 0 ? "up" : ordersChange < 0 ? "down" : "stable"
            },
            AverageOrderValue = new KpiCardDto
            {
                Label = "Average Order Value",
                Value = currentAvgOrderValue,
                Format = "currency"
            },
            MarginPercentage = new KpiCardDto
            {
                Label = "Margin",
                Value = currentMarginPercentage,
                Format = "percentage"
            },
            OutstandingAmount = new KpiCardDto
            {
                Label = "Outstanding",
                Value = outstanding,
                Format = "currency"
            },
            TopProducts = topProducts,
            RoutePerformance = routePerformance,
            TopSalesmen = salesmanPerformance,
            AsOfDate = targetDate,
            GeneratedAt = DateTime.UtcNow
        };

        return Result<DashboardKpisDto>.Success(result);
    }
}

#pragma warning restore CS9236