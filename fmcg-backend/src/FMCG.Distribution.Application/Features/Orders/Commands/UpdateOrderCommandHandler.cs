// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/UpdateOrderCommandHandler.cs
// UPDATED: Allow Admin to edit Approved orders (not just Draft/PendingApproval)

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Orders.DTOs;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class UpdateOrderCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateOrderCommand, Result<OrderDetailDto>>
{
    private const int MaxRetryAttempts = 3;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMilliseconds(200);

    public Task<Result<OrderDetailDto>> Handle(
        UpdateOrderCommand request, CancellationToken cancellationToken) =>
        TryUpdateWithRetry(request, 0, cancellationToken);

    private async Task<Result<OrderDetailDto>> TryUpdateWithRetry(
        UpdateOrderCommand request, int attempt, CancellationToken cancellationToken)
    {
        try
        {
            return await PerformUpdate(request, cancellationToken);
        }
        catch (DbUpdateConcurrencyException) when (attempt < MaxRetryAttempts - 1)
        {
            await Task.Delay(RetryDelay, cancellationToken);
            return await TryUpdateWithRetry(request, attempt + 1, cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result<OrderDetailDto>.Failure(
                "Save conflict. Please refresh the page and try again.");
        }
    }

    private async Task<Result<OrderDetailDto>> PerformUpdate(
        UpdateOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == request.Id && !o.IsDeleted, cancellationToken);

        if (order == null)
            return Result<OrderDetailDto>.Failure("Order not found.");

        // ── Permission matrix ──────────────────────────────────────────────────
        if (request.IsAdmin)
        {
            // Admin can edit: Draft, PendingApproval, OR Approved orders
            var adminEditableStatuses = new[] { OrderStatus.Draft, OrderStatus.PendingApproval, OrderStatus.Approved };
            if (!adminEditableStatuses.Contains(order.Status))
                return Result<OrderDetailDto>.Failure(
                    $"Cannot modify an order in '{order.Status}' status. " +
                    "Admin can only edit Draft, Pending Approval, or Approved orders.");
        }
        else
        {
            // Salesman can only edit Draft orders
            if (order.Status != OrderStatus.Draft)
                return Result<OrderDetailDto>.Failure(
                    $"Cannot edit order in '{order.Status}' status. " +
                    "Only Draft orders can be modified.");

            if (order.SalesmanId != request.SalesmanId)
                return Result<OrderDetailDto>.Failure("You are not authorised to modify this order.");

            if (order.IsLocked)
                return Result<OrderDetailDto>.Failure(
                    "This order is locked after daily closing and cannot be modified.");
        }

        var customer = await context.Customers
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId && !c.IsDeleted, cancellationToken);
        if (customer == null)
            return Result<OrderDetailDto>.Failure("Customer not found.");

        order.CustomerId = request.CustomerId;
        order.RouteId = customer.RouteId;
        order.Remarks = request.Remarks;
        order.MarkModified(request.SalesmanId.ToString());

        var updatedItemIds = new HashSet<Guid>();
        var itemsToAdd = new List<OrderItem>();

        foreach (var itemDto in request.Items)
        {
            if (itemDto.Id.HasValue)
            {
                var existingItem = order.Items?.FirstOrDefault(i => i.Id == itemDto.Id.Value);
                if (existingItem != null)
                {
                    var product = await context.Products
                        .FirstOrDefaultAsync(p => p.Id == itemDto.ProductId && p.IsActive && !p.IsDeleted, cancellationToken);
                    if (product == null)
                        return Result<OrderDetailDto>.Failure("Product not found or inactive.");

                    var qty = ResolveQuantity(itemDto.Quantity, itemDto.QuantityBags, itemDto.QuantityBoxes, itemDto.QuantityTins);
                    if (qty <= 0) return Result<OrderDetailDto>.Failure("Quantity must be > 0.");

                    existingItem.ProductId = itemDto.ProductId;
                    existingItem.Quantity = qty;
                    existingItem.UnitId = itemDto.UnitId;
                    existingItem.SellingPrice = itemDto.SellingPrice;
                    existingItem.QuantityBags = itemDto.QuantityBags;
                    existingItem.QuantityBoxes = itemDto.QuantityBoxes;
                    existingItem.QuantityTins = itemDto.QuantityTins;
                    existingItem.UpdateTimestamp(request.SalesmanId.ToString());
                    updatedItemIds.Add(existingItem.Id);
                }
            }
            else
            {
                var product = await context.Products
                    .FirstOrDefaultAsync(p => p.Id == itemDto.ProductId && p.IsActive && !p.IsDeleted, cancellationToken);
                if (product == null)
                    return Result<OrderDetailDto>.Failure("Product not found or inactive.");

                var qty = ResolveQuantity(itemDto.Quantity, itemDto.QuantityBags, itemDto.QuantityBoxes, itemDto.QuantityTins);
                if (qty <= 0) return Result<OrderDetailDto>.Failure("Quantity must be > 0.");

                var newItem = new OrderItem
                {
                    Id = Guid.NewGuid(),
                    OrderId = order.Id,
                    ProductId = itemDto.ProductId,
                    Quantity = qty,
                    UnitId = itemDto.UnitId,
                    SellingPrice = itemDto.SellingPrice,
                    BasePriceAtTime = itemDto.SellingPrice,
                    QuantityBags = itemDto.QuantityBags,
                    QuantityBoxes = itemDto.QuantityBoxes,
                    QuantityTins = itemDto.QuantityTins,
                };
                newItem.UpdateTimestamp(request.SalesmanId.ToString());
                itemsToAdd.Add(newItem);
                updatedItemIds.Add(newItem.Id);
            }
        }

        var itemsToRemove = order.Items?
            .Where(i => !updatedItemIds.Contains(i.Id))
            .ToList() ?? [];

        foreach (var item in itemsToRemove) context.OrderItems.Remove(item);
        foreach (var item in itemsToAdd) context.OrderItems.Add(item);

        await context.SaveChangesAsync(cancellationToken);

        var updatedOrder = await context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == order.Id, cancellationToken);

        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == order.RouteId && !r.IsDeleted, cancellationToken);

        var itemDtos = new List<OrderItemDto>();
        foreach (var item in updatedOrder?.Items ?? [])
        {
            var product = await context.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId, cancellationToken);
            var unit = await context.ProductUnits.FirstOrDefaultAsync(u => u.Id == item.UnitId, cancellationToken);

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
            CustomerName = customer.NameEnglish,
            CustomerNameMalayalam = customer.NameMalayalam,
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
        }, "Order updated successfully.");
    }

    private static decimal ResolveQuantity(decimal qty, decimal? bags, decimal? boxes, decimal? tins)
    {
        if (qty > 0) return qty;
        return (bags ?? 0) + (boxes ?? 0) + (tins ?? 0);
    }
}