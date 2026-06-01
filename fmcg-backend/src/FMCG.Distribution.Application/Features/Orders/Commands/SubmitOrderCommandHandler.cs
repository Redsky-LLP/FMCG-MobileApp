// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/SubmitOrderCommandHandler.cs
// CHANGED: Salesman submits Draft → PendingApproval.
// NOTE: SubmitOrderCommand is defined in SubmitOrderCommand.cs — not duplicated here.

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Orders.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class SubmitOrderCommandHandler(IApplicationDbContext context)
    : IRequestHandler<SubmitOrderCommand, Result<OrderDetailDto>>
{
    public async Task<Result<OrderDetailDto>> Handle(
        SubmitOrderCommand request,
        CancellationToken cancellationToken)
    {
        var order = await context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == request.Id && !o.IsDeleted, cancellationToken);

        if (order == null)
            return Result<OrderDetailDto>.Failure("Order not found.");

        if (order.SalesmanId != request.SalesmanId)
            return Result<OrderDetailDto>.Failure("You are not authorised to submit this order.");

        if (order.Status != OrderStatus.Draft)
            return Result<OrderDetailDto>.Failure(
                $"Cannot submit order in '{order.Status}' status. Only Draft orders can be submitted.");

        if (order.Items == null || order.Items.Count == 0)
            return Result<OrderDetailDto>.Failure(
                "Cannot submit an empty order. Please add at least one item.");

        // Draft → PendingApproval
        order.Status = OrderStatus.PendingApproval;
        order.SubmittedAt = DateTime.UtcNow;
        order.MarkModified(request.SalesmanId.ToString());

        await context.SaveChangesAsync(cancellationToken);

        var customer = await context.Customers
            .FirstOrDefaultAsync(c => c.Id == order.CustomerId && !c.IsDeleted, cancellationToken);

        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == order.RouteId && !r.IsDeleted, cancellationToken);

        var itemDtos = new List<OrderItemDto>();
        foreach (var item in order.Items)
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

        return Result<OrderDetailDto>.Success(new OrderDetailDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            CustomerId = order.CustomerId,
            CustomerName = customer?.NameEnglish ?? string.Empty,
            CustomerNameMalayalam = customer?.NameMalayalam,
            RouteId = order.RouteId,
            RouteName = route?.Name ?? string.Empty,
            Status = order.Status,
            OrderDate = order.OrderDate,
            TotalItems = itemDtos.Count,
            TotalQuantity = itemDtos.Sum(i => i.Quantity),
            TotalAmount = itemDtos.Sum(i => i.SellingPrice * i.Quantity),
            Remarks = order.Remarks,
            SubmittedAt = order.SubmittedAt,
            ClosedAt = order.ClosedAt,
            CreatedAt = order.CreatedAt,
            Items = itemDtos,
        }, "Order submitted for admin approval.");
    }
}