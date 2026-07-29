// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/CreateOrderCommandHandler.cs
// FIX: OrderDate now uses ExecutionDate from the route execution, not DateTime.UtcNow
//      This ensures that when a route is reopened on a later day, new orders still
//      show the original route execution date.

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

        // ─── GET ROUTE EXECUTION TO DETERMINE ORDER DATE ──────────────────────
        // This is the key fix: find the execution for this route and salesman
        // to get the correct execution date for the order.
        DateTime orderDate = DateTime.UtcNow; // Fallback
        Guid? executionId = null;

        // First, try to get the execution from the request
        if (request.ExecutionId.HasValue)
        {
            var execution = await context.RouteExecutions
                .FirstOrDefaultAsync(e => e.Id == request.ExecutionId.Value && !e.IsDeleted, cancellationToken);

            if (execution != null)
            {
                // Use the execution's created date as the order date
                orderDate = execution.CreatedAt;
                executionId = execution.Id;
            }
        }

        // If no execution from request, find the active execution for this route/salesman
        if (!executionId.HasValue)
        {
            var activeExecution = await context.RouteExecutions
                .Where(e => e.RouteId == customer.RouteId
                    && e.SalesmanId == request.SalesmanId
                    && e.Status == ExecutionStatus.InProgress
                    && !e.IsDeleted)
                .OrderByDescending(e => e.StartedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (activeExecution != null)
            {
                orderDate = activeExecution.CreatedAt;
                executionId = activeExecution.Id;
            }
        }

        // ─── IF ROUTE IS CLOSED, FIND THE MOST RECENT COMPLETED EXECUTION ──────
        // If no active execution found, check if there's a completed execution
        // that was recently closed (for reopened routes)
        if (!executionId.HasValue)
        {
            var completedExecution = await context.RouteExecutions
                .Where(e => e.RouteId == customer.RouteId
                    && e.SalesmanId == request.SalesmanId
                    && e.Status == ExecutionStatus.Completed
                    && !e.IsDeleted)
                .OrderByDescending(e => e.CompletedAt ?? e.UpdatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (completedExecution != null)
            {
                // Use the completed execution's date
                orderDate = completedExecution.CreatedAt;
                executionId = completedExecution.Id;
            }
        }

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

        // ── Allow orders with only remarks ──
        if (orderItems.Count == 0 && string.IsNullOrWhiteSpace(request.Remarks))
        {
            return Result<OrderDetailDto>.Failure("Add at least one product or retail remark to create an order.");
        }

        // ── Generate unique order number ──────────────────────────────────────
        var orderNumber = await GenerateOrderNumberAsync(cancellationToken);

        // ── Create the order ───────────────────────────────────────────────────
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = orderNumber,
            CustomerId = request.CustomerId,
            RouteId = customer.RouteId,
            SalesmanId = request.SalesmanId,
            OrderDate = orderDate,  // ← FIXED: Use execution date, not DateTime.UtcNow
            ExecutionId = executionId, // ← Store which execution this order belongs to
            Status = OrderStatus.Draft,
            Remarks = request.Remarks,
            Items = orderItems,
            CustomerVisitId = request.CustomerVisitId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await context.Orders.AddAsync(order, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        // ── Link to customer visit ──────────────────────────────────────────────
        CustomerVisit? visit = null;

        if (request.CustomerVisitId.HasValue && request.ExecutionId.HasValue)
        {
            visit = await context.CustomerVisits
                .FirstOrDefaultAsync(v => v.Id == request.CustomerVisitId.Value
                    && v.RouteExecutionId == request.ExecutionId.Value
                    && !v.IsDeleted, cancellationToken);
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
            }
        }

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
            OrderDate = order.OrderDate, // ← Now shows the execution date
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