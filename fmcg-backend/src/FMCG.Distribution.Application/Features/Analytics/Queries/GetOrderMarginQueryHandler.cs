using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetOrderMarginQueryHandler : IRequestHandler<GetOrderMarginQuery, Result<OrderMarginDto>>
{
    private readonly IApplicationDbContext _context;

    public GetOrderMarginQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<OrderMarginDto>> Handle(GetOrderMarginQuery request, CancellationToken cancellationToken)
    {
        var order = await _context.Orders
            .Include(o => o.Customer)
            .Include(o => o.Route)
            .Include(o => o.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(o => o.Id == request.OrderId && !o.IsDeleted, cancellationToken);

        if (order == null)
        {
            return Result<OrderMarginDto>.Failure("Order not found.");
        }

        // Authorization: Salesman can only view their own orders
        if (!request.IsAdmin && request.UserId.HasValue && order.SalesmanId != request.UserId.Value)
        {
            return Result<OrderMarginDto>.Failure("You are not authorized to view this order's margin.");
        }

        var itemDtos = new List<OrderItemMarginDto>();
        decimal totalSales = 0;
        decimal totalBaseCost = 0;

        foreach (var item in order.Items ?? [])
        {
            var variance = (item.SellingPrice - item.BasePriceAtTime) * item.Quantity;
            totalSales += item.SellingPrice * item.Quantity;
            totalBaseCost += item.BasePriceAtTime * item.Quantity;

            itemDtos.Add(new OrderItemMarginDto
            {
                ProductId = item.ProductId,
                ProductName = item.Product?.NameEnglish ?? string.Empty,
                Quantity = item.Quantity,
                SellingPrice = item.SellingPrice,
                BasePriceAtTime = item.BasePriceAtTime,
                Variance = variance
            });
        }

        var totalVariance = totalSales - totalBaseCost;
        var marginPercentage = totalSales > 0 ? (totalVariance / totalSales) * 100 : 0;

        var result = new OrderMarginDto
        {
            OrderId = order.Id,
            OrderNumber = order.OrderNumber,
            CustomerId = order.CustomerId,
            CustomerName = order.Customer?.NameEnglish ?? string.Empty,
            RouteId = order.RouteId,
            RouteName = order.Route?.Name ?? string.Empty,
            OrderDate = order.OrderDate.ToUniversalTime(),
            Status = order.Status.ToString(),
            TotalSales = totalSales,
            TotalBaseCost = totalBaseCost,
            TotalVariance = totalVariance,
            MarginPercentage = marginPercentage,
            Items = itemDtos
        };

        return Result<OrderMarginDto>.Success(result);
    }
}