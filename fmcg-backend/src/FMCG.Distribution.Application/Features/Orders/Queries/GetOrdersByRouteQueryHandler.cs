// PATH: src/FMCG.Distribution.Application/Features/Orders/Queries/GetOrdersByRouteQueryHandler.cs
// FIXED: Use the correct DTO structure

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Orders.DTOs;

namespace FMCG.Distribution.Application.Features.Orders.Queries;

public class GetOrdersByRouteQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetOrdersByRouteQuery, Result<List<OrderDto>>>
{
    public async Task<Result<List<OrderDto>>> Handle(GetOrdersByRouteQuery request, CancellationToken cancellationToken)
    {
        var query = context.Orders
            .Include(o => o.Customer)
            .Include(o => o.Route)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Unit)
            .Where(o => o.RouteId == request.RouteId && !o.IsDeleted);

        // Filter by salesman if provided
        if (request.SalesmanId.HasValue)
        {
            query = query.Where(o => o.SalesmanId == request.SalesmanId.Value);
        }

        // Filter by status if provided
        if (request.Status.HasValue)
        {
            query = query.Where(o => o.Status == request.Status.Value);
        }

        var orders = await query
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync(cancellationToken);

        var result = orders.Select(o => new OrderDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            CustomerId = o.CustomerId,
            CustomerName = o.Customer?.NameEnglish ?? string.Empty,
            CustomerNameMalayalam = o.Customer?.NameMalayalam,
            RouteId = o.RouteId,
            RouteName = o.Route?.Name ?? string.Empty,
            Status = o.Status,
            OrderDate = o.OrderDate,
            TotalItems = o.Items?.Count ?? 0,
            TotalQuantity = o.Items?.Sum(i => i.Quantity) ?? 0,
            TotalAmount = o.Items?.Sum(i => i.SellingPrice * i.Quantity) ?? 0,
            Remarks = o.Remarks,
            SubmittedAt = o.SubmittedAt,
            ClosedAt = o.ClosedAt,
            CreatedAt = o.CreatedAt,
            Items = o.Items?.Select(i => new OrderItemDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                ProductName = i.Product?.NameEnglish ?? string.Empty,
                ProductNameMalayalam = i.Product?.NameMalayalam,
                Quantity = i.Quantity,
                UnitId = i.UnitId,
                UnitName = i.Unit?.Name ?? string.Empty,
                UnitSymbol = i.Unit?.Symbol,
                SellingPrice = i.SellingPrice,
                BasePriceAtTime = i.BasePriceAtTime,
                QuantityBags = i.QuantityBags,
                QuantityBoxes = i.QuantityBoxes,
                QuantityTins = i.QuantityTins,
            }).ToList() ?? new List<OrderItemDto>()
        }).ToList();

        return Result<List<OrderDto>>.Success(result);
    }
}