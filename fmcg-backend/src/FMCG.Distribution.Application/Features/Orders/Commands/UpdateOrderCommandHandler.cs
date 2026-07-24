// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/UpdateOrderCommandHandler.cs
// UPDATED: Allow Admin to edit Approved orders (not just Draft/PendingApproval)
// FIXED: New items added to existing orders now use product.BasePrice for BasePriceAtTime
//        instead of incorrectly using SellingPrice.
// NEW: New items added to existing orders also capture ProductNameAtTime /
//      ProductNameMalayalamAtTime / SizeGroupNameAtTime, same as CreateOrderCommandHandler.
//      Existing items are deliberately left untouched — the whole point of this snapshot
//      is that it's set once, at the moment an OrderItem row is first created, and never
//      overwritten afterwards, including through edits, reopen, or re-close. This mirrors
//      exactly how BasePriceAtTime already behaves for existingItem below.

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
        // ── Universal lock check — applies to admin and salesman alike.
        // Once admin runs Close Day, IsLocked is true on this order and
        // nobody edits it anymore, regardless of role or status. ──
        if (order.IsLocked)
            return Result<OrderDetailDto>.Failure(
                "This order is locked after daily closing and cannot be modified.");

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
        }
        // ── FIX: Allow orders with only remarks (no items) ──
        // If there are no items in the request but remarks exist, allow the update
        if (request.Items.Count == 0 && string.IsNullOrWhiteSpace(request.Remarks))
        {
            return Result<OrderDetailDto>.Failure("Add at least one product or retail remark to update this order.");
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
                    // ── FIX: Allow zero quantity for remarks-only orders ──
                    // Quantity can be 0 only if there are no other items and remarks exist
                    if (qty < 0) return Result<OrderDetailDto>.Failure("Quantity cannot be negative.");

                    existingItem.ProductId = itemDto.ProductId;
                    existingItem.Quantity = qty;
                    existingItem.UnitId = itemDto.UnitId;
                    existingItem.SellingPrice = itemDto.SellingPrice;
                    existingItem.QuantityBags = itemDto.QuantityBags;
                    existingItem.QuantityBoxes = itemDto.QuantityBoxes;
                    existingItem.QuantityTins = itemDto.QuantityTins;
                    // ── NOTE: BasePriceAtTime, ProductNameAtTime, ProductNameMalayalamAtTime,
                    // and SizeGroupNameAtTime are deliberately NOT touched here — they were
                    // set once when this item was first created and stay frozen through any
                    // number of edits, reopens, or re-closes. Only genuinely new items (below)
                    // get a fresh snapshot. ──
                    existingItem.UpdateTimestamp(request.SalesmanId.ToString());
                    updatedItemIds.Add(existingItem.Id);
                }
            }
            else
            {
                // ── Include SizeGroup so we can snapshot its name below, same as
                // CreateOrderCommandHandler does for brand-new orders. ──
                var product = await context.Products
                    .Include(p => p.SizeGroup)
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
                    BasePriceAtTime = product.BasePrice,  // ← FIXED: Use product's current base price, not SellingPrice
                    // ── NEW: name/size-group snapshot for this newly-added item ──
                    ProductNameAtTime = product.NameEnglish,
                    ProductNameMalayalamAtTime = product.NameMalayalam,
                    SizeGroupNameAtTime = product.SizeGroup?.Name,
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

        // ── Link to customer visit, if this order isn't linked yet ─────────────
        // UpdateOrderCommand has no execution context to go on, so resolve it
        // from whatever in-progress execution this salesman has for this route
        // right now. This is what makes editing/saving an order taken from a
        // page without execution context (e.g. a plain customer list) finally
        // mark that stop as done on the route execution page.
        var inProgressExecution = await context.RouteExecutions
            .Where(e => e.RouteId == order.RouteId
                && e.SalesmanId == request.SalesmanId
                && e.Status == ExecutionStatus.InProgress
                && !e.IsDeleted)
            .OrderByDescending(e => e.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (inProgressExecution != null)
        {
            var visit = await context.CustomerVisits
                .FirstOrDefaultAsync(v => v.RouteExecutionId == inProgressExecution.Id
                    && v.CustomerId == request.CustomerId
                    && !v.IsDeleted, cancellationToken);

            if (visit != null && visit.Status == VisitStatus.Pending)
            {
                visit.RecordOrder(order.Id);
                await context.SaveChangesAsync(cancellationToken);
            }
        }

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
            IsLocked = order.IsLocked,
        }, "Order updated successfully.");
    }

    private static decimal ResolveQuantity(decimal qty, decimal? bags, decimal? boxes, decimal? tins)
    {
        if (qty > 0) return qty;
        return (bags ?? 0) + (boxes ?? 0) + (tins ?? 0);
    }
}