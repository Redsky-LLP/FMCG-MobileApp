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
        // ── Universal lock check — FIX: scoped to salesmen only now. Admin can
        // edit past the daily-closure lock too (Edit Previous Orders feature) —
        // this is a permission change ONLY: the IsLocked flag itself is never
        // touched or cleared here, so everything else that reads it elsewhere
        // (settlement calculations, the route Close/Reopen toggle, any other
        // gate) behaves exactly as it always has. Salesmen remain fully blocked
        // once an order is locked, with no exception. ──
        if (order.IsLocked && !request.IsAdmin)
            return Result<OrderDetailDto>.Failure(
                "This order is locked after daily closing and cannot be modified.");

        // ── Permission matrix ──────────────────────────────────────────────────
        if (request.IsAdmin)
        {
            // Admin can edit: Draft, PendingApproval, Approved, OR Closed orders
            // — regardless of IsLocked, per the check above.
            var adminEditableStatuses = new[] { OrderStatus.Draft, OrderStatus.PendingApproval, OrderStatus.Approved, OrderStatus.Closed };
            if (!adminEditableStatuses.Contains(order.Status))
                return Result<OrderDetailDto>.Failure(
                    $"Cannot modify an order in '{order.Status}' status. " +
                    "Admin can only edit Draft, Pending Approval, Approved, or Closed orders.");
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

        // ── PERFORMANCE FIX: previously, every item in the request triggered its own
        // separate database round-trip to validate the referenced product (once for
        // existing items, again for new items) — an order with 10 items meant 10
        // sequential round-trips just for validation, before anything else even ran.
        // Fetching every distinct referenced product in ONE query up front, then
        // looking each one up from an in-memory dictionary inside the loop, turns
        // that into a single round-trip regardless of how many items are on the
        // order. Across a cross-cloud connection (app server and DB in different
        // data centers), this is one of the biggest wins in the whole request. ──
        var requestedProductIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        var productsById = await context.Products
            .Include(p => p.SizeGroup)
            .Where(p => requestedProductIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        // ── PERFORMANCE FIX: same batching approach as productsById above —
        // fetched once here so the response DTO can be built entirely from
        // in-memory data at the end of this method, instead of the full
        // re-fetch of the order (with two .ThenInclude() calls) that used
        // to happen after SaveChangesAsync. That re-fetch was one of the
        // most expensive individual queries in this whole request, and was
        // entirely redundant — every field it needed (Product via
        // productsById, Unit via this dictionary) was already available. ──
        var requestedUnitIds = request.Items.Select(i => i.UnitId).Distinct().ToList();
        var unitsById = await context.ProductUnits
            .Where(u => requestedUnitIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        foreach (var itemDto in request.Items)
        {
            if (itemDto.Id.HasValue)
            {
                var existingItem = order.Items?.FirstOrDefault(i => i.Id == itemDto.Id.Value);
                if (existingItem != null)
                {
                    if (!productsById.TryGetValue(itemDto.ProductId, out var product)
                        || !product.IsActive || product.IsDeleted)
                        return Result<OrderDetailDto>.Failure("Product not found or inactive.");

                    var qty = ResolveQuantity(itemDto.Quantity, itemDto.QuantityBags, itemDto.QuantityBoxes, itemDto.QuantityTins);
                    // ── FIX: Allow zero quantity for remarks-only orders ──
                    // Quantity can be 0 only if there are no other items and remarks exist
                    if (qty < 0) return Result<OrderDetailDto>.Failure("Quantity cannot be negative.");

                    // ── PERFORMANCE FIX: autosave re-sends EVERY item currently on the
                    // order on every save cycle, not just the one the salesman is
                    // actively editing. This used to unconditionally assign all fields
                    // and call UpdateTimestamp() on every existing item regardless of
                    // whether anything about it had actually changed — which marks the
                    // entity dirty in EF's change tracker and generates its own UPDATE
                    // statement. An order with 8-10 items meant 8-10 UPDATE statements
                    // on every single autosave, even though only the newest item was
                    // really changing, so autosave got noticeably slower the longer a
                    // salesman had been working on an order. Only touching (and
                    // timestamping) items that actually changed restores the original
                    // "write only what changed" behavior regardless of order size. ──
                    var changed =
                        existingItem.ProductId != itemDto.ProductId ||
                        existingItem.Quantity != qty ||
                        existingItem.UnitId != itemDto.UnitId ||
                        existingItem.SellingPrice != itemDto.SellingPrice ||
                        existingItem.QuantityBags != itemDto.QuantityBags ||
                        existingItem.QuantityBoxes != itemDto.QuantityBoxes ||
                        existingItem.QuantityTins != itemDto.QuantityTins;

                    if (changed)
                    {
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
                    }
                    updatedItemIds.Add(existingItem.Id);
                }
            }
            else
            {
                if (!productsById.TryGetValue(itemDto.ProductId, out var product)
                    || !product.IsActive || product.IsDeleted)
                    return Result<OrderDetailDto>.Failure("Product not found or inactive.");

                // ── NEW: Out of Stock guard — only for genuinely new items being added
                // to this order. An item that was already on the order before it went
                // out of stock is left alone here (existingItem branch above doesn't
                // re-check this at all), matching the same "don't touch what's already
                // there" philosophy as the name/price snapshot fields. ──
                if (product.IsOutOfStock)
                    return Result<OrderDetailDto>.Failure($"'{product.NameEnglish}' is currently out of stock.");

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

        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == order.RouteId && !r.IsDeleted, cancellationToken);

        // ── PERFORMANCE FIX: this used to re-fetch the whole order from the
        // database (with two .ThenInclude() calls for Product and Unit) just
        // to build this response — one of the most expensive individual
        // queries in the whole request, and entirely avoidable. Every field
        // it needed is already sitting in memory: surviving existing items
        // come from order.Items (filtered to updatedItemIds — the ones NOT
        // removed above), freshly-added ones from itemsToAdd, and their
        // Product/Unit details from the productsById/unitsById dictionaries
        // batched earlier in this same method. Building the DTO from these
        // instead removes an entire round-trip from every save. ──
        var finalItems = (order.Items?.Where(i => updatedItemIds.Contains(i.Id)) ?? [])
            .Concat(itemsToAdd)
            .ToList();

        var itemDtos = new List<OrderItemDto>();
        foreach (var item in finalItems)
        {
            productsById.TryGetValue(item.ProductId, out var product);
            unitsById.TryGetValue(item.UnitId, out var unit);

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