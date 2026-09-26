// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/CreateOrderCommandHandler.cs
// FIX: Replaced SemaphoreSlim + SELECT-based order number generation with
//      PostgreSQL sequence (order_number_seq) via IApplicationDbContext.NextOrderSequenceAsync().
// FIX: Unit lookup no longer requires IsActive - only checks IsDeleted
// NEW: Captures ProductNameAtTime / ProductNameMalayalamAtTime / SizeGroupNameAtTime.
// NEW: catches the IX_Orders_CustomerId_ActiveUnique unique-constraint violation
//      (see ApplicationDbContext) and returns a friendly, actionable message
//      instead of letting the raw Postgres error surface. This is the backstop
//      for the manual-save/autosave race that the frontend's new save queue
//      (OrderEntry.tsx) already prevents in the common case — this catch only
//      fires for the races that queue can't reach (a second browser tab, a
//      second device, a retried request after a dropped connection).

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Orders.DTOs;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class CreateOrderCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateOrderCommand, Result<OrderDetailDto>>
{
    public async Task<Result<OrderDetailDto>> Handle(CreateOrderCommand request, CancellationToken cancellationToken)
    {
        // ── Validate Customer ──────────────────────────────────────────────────
        var customer = await context.Customers
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId && !c.IsDeleted, cancellationToken);

        if (customer == null)
            return Result<OrderDetailDto>.Failure("Customer not found.");

        // ── Validate Salesman ──────────────────────────────────────────────────
        var salesman = await context.Users
            .FirstOrDefaultAsync(u => u.Id == request.SalesmanId && u.IsActive && u.Role == UserRole.Salesman, cancellationToken);

        if (salesman == null)
            return Result<OrderDetailDto>.Failure("Salesman not found.");

        // ── Validate Route ─────────────────────────────────────────────────────
        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == customer.RouteId && !r.IsDeleted, cancellationToken);

        if (route == null)
            return Result<OrderDetailDto>.Failure("Route not found for this customer.");

        // ── Build order items ──────────────────────────────────────────────────
        var orderItems = new List<OrderItem>();
        var itemDtos = new List<OrderItemDto>();

        var requestedProductIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        var requestedUnitIds = request.Items.Select(i => i.UnitId).Distinct().ToList();

        var productsById = await context.Products
            .Include(p => p.DefaultUnit)
            .Include(p => p.SizeGroup)
            .Where(p => requestedProductIds.Contains(p.Id) && p.IsActive && !p.IsDeleted)
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        var unitsById = await context.ProductUnits
            .Where(u => requestedUnitIds.Contains(u.Id) && !u.IsDeleted)
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        foreach (var item in request.Items)
        {
            if (!productsById.TryGetValue(item.ProductId, out var product))
                return Result<OrderDetailDto>.Failure($"Product '{item.ProductId}' not found or inactive.");

            if (product.IsOutOfStock)
                return Result<OrderDetailDto>.Failure($"'{product.NameEnglish}' is currently out of stock.");

            var resolvedQty = ResolveQuantity(item.Quantity, item.QuantityBags, item.QuantityBoxes, item.QuantityTins);
            if (resolvedQty <= 0)
                return Result<OrderDetailDto>.Failure($"Quantity must be greater than zero for '{product.NameEnglish}'.");

            if (item.SellingPrice <= 0)
                return Result<OrderDetailDto>.Failure($"Selling price must be greater than zero for '{product.NameEnglish}'.");

            if (!unitsById.TryGetValue(item.UnitId, out var unit))
                return Result<OrderDetailDto>.Failure($"Unit not found for product '{product.NameEnglish}'.");

            orderItems.Add(new OrderItem
            {
                Id = Guid.NewGuid(),
                ProductId = item.ProductId,
                Quantity = resolvedQty,
                UnitId = item.UnitId,
                SellingPrice = item.SellingPrice,
                BasePriceAtTime = product.BasePrice,
                ProductNameAtTime = product.NameEnglish,
                ProductNameMalayalamAtTime = product.NameMalayalam,
                SizeGroupNameAtTime = product.SizeGroup?.Name,
                QuantityBags = item.QuantityBags,
                QuantityBoxes = item.QuantityBoxes,
                QuantityTins = item.QuantityTins,
            });

            itemDtos.Add(new OrderItemDto
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                ProductName = product.NameEnglish,
                ProductNameMalayalam = product.NameMalayalam,
                Quantity = resolvedQty,
                UnitId = unit.Id,
                UnitName = unit.Name,
                UnitSymbol = unit.Symbol,
                SellingPrice = item.SellingPrice,
                BasePriceAtTime = product.BasePrice,
                QuantityBags = item.QuantityBags,
                QuantityBoxes = item.QuantityBoxes,
                QuantityTins = item.QuantityTins,
            });
        }

        if (orderItems.Count == 0 && string.IsNullOrWhiteSpace(request.Remarks))
        {
            return Result<OrderDetailDto>.Failure("Add at least one product or retail remark to create an order.");
        }

        CustomerVisit? visit = null;
        DateTime? executionDate = null;

        if (request.CustomerVisitId.HasValue && request.ExecutionId.HasValue)
        {
            visit = await context.CustomerVisits
                .FirstOrDefaultAsync(v => v.Id == request.CustomerVisitId.Value
                    && v.RouteExecutionId == request.ExecutionId.Value
                    && !v.IsDeleted, cancellationToken);

            if (visit != null)
            {
                executionDate = await context.RouteExecutions
                    .Where(e => e.Id == request.ExecutionId.Value && !e.IsDeleted)
                    .Select(e => (DateTime?)e.ExecutionDate)
                    .FirstOrDefaultAsync(cancellationToken);
            }
        }

        if (visit == null)
        {
            var inProgressExecution = await context.RouteExecutions
                .Where(e => e.RouteId == customer.RouteId
                    && e.SalesmanId == request.SalesmanId
                    && e.Status == ExecutionStatus.InProgress
                    && !e.IsDeleted)
                .OrderByDescending(e => e.StartedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (inProgressExecution != null)
            {
                visit = await context.CustomerVisits
                    .FirstOrDefaultAsync(v => v.RouteExecutionId == inProgressExecution.Id
                        && v.CustomerId == request.CustomerId
                        && !v.IsDeleted, cancellationToken);

                executionDate = inProgressExecution.ExecutionDate;
            }
        }

        // ── Duplicate-order guard (check-then-act) — still worth keeping as a
        // fast, cheap early-out for the common case, even though it can't
        // fully close the race on its own. The unique index below is what
        // actually guarantees correctness when two requests land close
        // enough together that both pass this check. ──
        if (visit != null && visit.OrderId.HasValue)
        {
            return Result<OrderDetailDto>.Failure("An order already exists for this visit.");
        }

        // ── Generate unique order number via PostgreSQL sequence ───────────────
        var orderNumber = await GenerateOrderNumberAsync(cancellationToken);

        // ── Create the order ───────────────────────────────────────────────────
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = orderNumber,
            CustomerId = request.CustomerId,
            RouteId = customer.RouteId,
            SalesmanId = request.SalesmanId,
            OrderDate = executionDate ?? DateTime.UtcNow,
            Status = OrderStatus.Draft,
            Remarks = request.Remarks,
            Items = orderItems,
            CustomerVisitId = request.CustomerVisitId,
        };

        await context.Orders.AddAsync(order, cancellationToken);

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (
            ex.InnerException?.Message.Contains("IX_Orders_CustomerId_ActiveUnique") == true)
        {
            // ── FIX: this is the database-level backstop firing — a
            // concurrent request (a different browser tab, a different
            // device, or a retried request) already created an active order
            // for this customer between when THIS request read the world and
            // when it tried to write. Rather than surfacing a raw constraint-
            // violation error, tell the salesman plainly what happened; the
            // client should refetch and continue editing the order that won,
            // instead of silently creating a duplicate. ──
            return Result<OrderDetailDto>.Failure(
                "An order is already in progress for this customer. Please refresh the page to continue editing it.");
        }

        // ── Mark the visit as ordered, now that the order exists ──
        if (visit != null && visit.Status == VisitStatus.Pending)
        {
            visit.RecordOrder(order.Id);
            await context.SaveChangesAsync(cancellationToken);
        }

        var routeDetails = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == customer.RouteId, cancellationToken);

        return Result<OrderDetailDto>.Success(new OrderDetailDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            CustomerId = order.CustomerId,
            CustomerName = customer.NameEnglish,
            CustomerNameMalayalam = customer.NameMalayalam,
            RouteId = order.RouteId,
            RouteName = routeDetails?.Name ?? string.Empty,
            Status = order.Status,
            OrderDate = order.OrderDate,
            TotalItems = itemDtos.Count,
            TotalQuantity = itemDtos.Sum(i => i.Quantity),
            TotalAmount = itemDtos.Sum(i => i.SellingPrice * i.Quantity),
            Remarks = order.Remarks,
            SubmittedAt = order.SubmittedAt,
            ApprovedAt = order.ApprovedAt,
            ClosedAt = order.ClosedAt,
            CreatedAt = order.CreatedAt,
            Items = itemDtos,
        }, "Order created successfully.");
    }

    private async Task<string> GenerateOrderNumberAsync(CancellationToken cancellationToken)
    {
        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        var seqValue = await context.NextOrderSequenceAsync(cancellationToken);
        return $"ORD-{datePart}-{seqValue:D4}";
    }

    private static decimal ResolveQuantity(decimal rawQty, int? bags, int? boxes, int? tins)
    {
        if (bags.HasValue || boxes.HasValue || tins.HasValue)
            return (bags ?? 0) + (boxes ?? 0) + (tins ?? 0);
        return rawQty;
    }
}