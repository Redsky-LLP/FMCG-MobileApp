// PATH: src/FMCG.Distribution.Application/Features/Orders/Queries/GetOrderByIdQueryHandler.cs
// FIXED: Use primary constructor

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Orders.DTOs;

namespace FMCG.Distribution.Application.Features.Orders.Queries;

public class GetOrderByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetOrderByIdQuery, Result<OrderDetailDto>>
{
    public async Task<Result<OrderDetailDto>> Handle(GetOrderByIdQuery request, CancellationToken cancellationToken)
    {
        var order = await context.Orders
            .Include(o => o.Customer)
            .Include(o => o.Route)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Unit)
            .FirstOrDefaultAsync(o => o.Id == request.Id && !o.IsDeleted, cancellationToken);

        if (order == null)
        {
            return Result<OrderDetailDto>.Failure("Order not found.");
        }

        // Authorization: Salesman can only view their own orders
        if (!request.IsAdmin && request.SalesmanId.HasValue && order.SalesmanId != request.SalesmanId.Value)
        {
            return Result<OrderDetailDto>.Failure("You are not authorized to view this order.");
        }

        var itemDtos = new List<OrderItemDto>();
        foreach (var item in order.Items ?? [])
        {
            var product = await context.Products
                .FirstOrDefaultAsync(p => p.Id == item.ProductId, cancellationToken);
            var unit = await context.ProductUnits
                .FirstOrDefaultAsync(u => u.Id == item.UnitId, cancellationToken);

            itemDtos.Add(new OrderItemDto
            {
                Id = item.Id,
                ProductId = item.ProductId,
                ProductName = product?.NameEnglish ?? string.Empty,
                ProductNameMalayalam = product?.NameMalayalam,
                Quantity = item.Quantity,
                UnitId = item.UnitId,
                UnitName = unit?.Name ?? string.Empty,
                UnitSymbol = unit?.Symbol,
                SellingPrice = item.SellingPrice,
                BasePriceAtTime = item.BasePriceAtTime,
                QuantityBags = item.QuantityBags,
                QuantityBoxes = item.QuantityBoxes,
                QuantityTins = item.QuantityTins,
            });
        }

        var resultDto = new OrderDetailDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            CustomerId = order.CustomerId,
            CustomerName = order.Customer?.NameEnglish ?? string.Empty,
            CustomerNameMalayalam = order.Customer?.NameMalayalam,
            RouteId = order.RouteId,
            RouteName = order.Route?.Name ?? string.Empty,
            Status = order.Status,
            OrderDate = order.OrderDate,
            TotalItems = itemDtos.Count,
            TotalQuantity = itemDtos.Sum(i => i.Quantity),
            TotalAmount = itemDtos.Sum(i => i.SellingPrice * i.Quantity),
            Remarks = order.Remarks,
            SubmittedAt = order.SubmittedAt,
            ClosedAt = order.ClosedAt,
            CreatedAt = order.CreatedAt,
            Items = itemDtos
        };

        return Result<OrderDetailDto>.Success(resultDto);
    }
}