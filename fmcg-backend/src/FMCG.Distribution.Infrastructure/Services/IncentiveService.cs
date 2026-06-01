using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Incentives.DTOs;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Infrastructure.Services;

public class IncentiveService(IApplicationDbContext context) : IIncentiveService
{
    public async Task<SalesmanIncentiveSummaryDto> CalculateSalesmanIncentiveAsync(
        Guid salesmanId,
        DateTime fromDate,
        DateTime toDate,
        CancellationToken cancellationToken = default)
    {
        // Get salesman details
        var salesman = await context.Users
            .FirstOrDefaultAsync(u => u.Id == salesmanId && u.Role == UserRole.Salesman && !u.IsDeleted, cancellationToken);

        if (salesman == null)
        {
            throw new InvalidOperationException($"Salesman with ID {salesmanId} not found.");
        }

        // Get orders for the salesman in the date range
        var orders = await context.Orders
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product)
            .Where(o => !o.IsDeleted
                && o.SalesmanId == salesmanId
                && o.Status != OrderStatus.Draft
                && o.OrderDate.Date >= fromDate.Date
                && o.OrderDate.Date <= toDate.Date)
            .ToListAsync(cancellationToken);

        // Get all product incentives active during this period
        var productIds = orders.SelectMany(o => o.Items!.Select(i => i.ProductId)).Distinct();
        var incentives = await context.ProductIncentives
            .Include(i => i.Product)
            .Where(i => productIds.Contains(i.ProductId)
                && i.IsActive
                && i.EffectiveDate <= toDate
                && (!i.EndDate.HasValue || i.EndDate.Value >= fromDate))
            .ToListAsync(cancellationToken);

        var breakdown = new List<IncentiveBreakdownDto>();
        decimal totalIncentive = 0;
        decimal totalSales = 0;

        foreach (var order in orders)
        {
            foreach (var item in order.Items!)
            {
                var orderTotal = item.SellingPrice * item.Quantity;
                totalSales += orderTotal;

                // Find applicable incentive for this product
                var incentive = incentives.FirstOrDefault(i => i.ProductId == item.ProductId
                    && i.EffectiveDate <= order.OrderDate
                    && (!i.EndDate.HasValue || i.EndDate.Value >= order.OrderDate));

                if (incentive != null)
                {
                    decimal incentiveEarned = 0;
                    if (incentive.IncentiveType == IncentiveType.PerUnit)
                    {
                        incentiveEarned = incentive.IncentiveValue * item.Quantity;
                    }
                    else // Percentage
                    {
                        incentiveEarned = (item.SellingPrice * item.Quantity) * (incentive.IncentiveValue / 100);
                    }

                    totalIncentive += incentiveEarned;

                    breakdown.Add(new IncentiveBreakdownDto
                    {
                        ProductId = item.ProductId,
                        ProductName = item.Product?.NameEnglish ?? string.Empty,
                        Quantity = item.Quantity,
                        IncentiveRate = incentive.IncentiveValue,
                        IncentiveType = incentive.IncentiveType.ToString(),
                        IncentiveEarned = incentiveEarned
                    });
                }
            }
        }

        return new SalesmanIncentiveSummaryDto
        {
            SalesmanId = salesmanId,
            SalesmanName = salesman.FullName,
            PeriodStart = fromDate,
            PeriodEnd = toDate,
            TotalSales = totalSales,
            TotalIncentive = totalIncentive,
            Breakdown = breakdown
        };
    }

    public async Task<RouteIncentiveSummaryDto> CalculateRouteIncentiveAsync(
        Guid routeId,
        DateTime fromDate,
        DateTime toDate,
        CancellationToken cancellationToken = default)
    {
        // Get route details
        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == routeId && !r.IsDeleted, cancellationToken);

        if (route == null)
        {
            throw new InvalidOperationException($"Route with ID {routeId} not found.");
        }

        // Get salesmen assigned to this route
        var salesmen = await context.Users
            .Where(u => u.Role == UserRole.Salesman
                && context.Routes.Any(r => r.Id == routeId && r.AssignedSalesmanId == u.Id)
                && !u.IsDeleted)
            .ToListAsync(cancellationToken);

        var salesmanSummaries = new List<SalesmanIncentiveSummaryDto>();
        decimal totalRouteSales = 0;
        decimal totalRouteIncentive = 0;

        foreach (var salesman in salesmen)
        {
            var summary = await CalculateSalesmanIncentiveAsync(salesman.Id, fromDate, toDate, cancellationToken);
            salesmanSummaries.Add(summary);
            totalRouteSales += summary.TotalSales;
            totalRouteIncentive += summary.TotalIncentive;
        }

        return new RouteIncentiveSummaryDto
        {
            RouteId = routeId,
            RouteName = route.Name,
            PeriodStart = fromDate,
            PeriodEnd = toDate,
            TotalSales = totalRouteSales,
            TotalIncentive = totalRouteIncentive,
            ActiveSalesmenCount = salesmen.Count,
            Salesmen = salesmanSummaries
        };
    }

    public async Task<decimal> GetProductIncentiveRateAsync(
        Guid productId,
        DateTime asOfDate,
        CancellationToken cancellationToken = default)
    {
        var incentive = await context.ProductIncentives
            .Where(i => i.ProductId == productId
                && i.IsActive
                && i.EffectiveDate <= asOfDate
                && (!i.EndDate.HasValue || i.EndDate.Value >= asOfDate))
            .OrderByDescending(i => i.EffectiveDate)
            .FirstOrDefaultAsync(cancellationToken);

        return incentive?.IncentiveValue ?? 0;
    }
}