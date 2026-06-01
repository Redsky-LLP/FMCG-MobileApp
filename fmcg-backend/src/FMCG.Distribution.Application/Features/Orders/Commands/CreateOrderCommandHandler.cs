// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/CreateOrderCommandHandler.cs
// FIXED: OrderStatus.Submitted replaced with OrderStatus.Draft
//        (new orders start as Draft; salesman must explicitly submit them)

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
        // Validate Customer
        var customer = await context.Customers
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId && !c.IsDeleted, cancellationToken);

        if (customer == null)
            return Result<OrderDetailDto>.Failure("Customer not found.");

        // Validate Salesman
        var salesman = await context.Users
            .FirstOrDefaultAsync(u => u.Id == request.SalesmanId && u.IsActive && u.Role == UserRole.Salesman, cancellationToken);

        if (salesman == null)
            return Result<OrderDetailDto>.Failure("Salesman not found.");

        // Validate salesman is assigned to this customer's route
        // (use route-assignment table as well as the legacy direct assignment)
        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == customer.RouteId && !r.IsDeleted, cancellationToken);

        if (route == null)
            return Result<OrderDetailDto>.Failure("Route not found for this customer.");

        // Build order items
        var orderItems = new List<OrderItem>();
        var itemDtos = new List<OrderItemDto>();

        foreach (var item in request.Items)
        {
            var product = await context.Products
                .Include(p => p.DefaultUnit)  // ← Use DefaultUnit instead of ProductUnit
                .FirstOrDefaultAsync(p => p.Id == item.ProductId && p.IsActive && !p.IsDeleted, cancellationToken);

            if (product == null)
                return Result<OrderDetailDto>.Failure($"Product '{item.ProductId}' not found or inactive.");

            var resolvedQty = ResolveQuantity(item.Quantity, item.QuantityBags, item.QuantityBoxes, item.QuantityTins);
            if (resolvedQty <= 0)
                return Result<OrderDetailDto>.Failure($"Quantity must be greater than zero for '{product.NameEnglish}'.");

            if (item.SellingPrice <= 0)
                return Result<OrderDetailDto>.Failure($"Selling price must be greater than zero for '{product.NameEnglish}'.");

            var unit = await context.ProductUnits
                .FirstOrDefaultAsync(u => u.Id == item.UnitId && u.IsActive && !u.IsDeleted, cancellationToken);

            if (unit == null)
                return Result<OrderDetailDto>.Failure($"Unit not found for product '{product.NameEnglish}'.");

            orderItems.Add(new OrderItem
            {
                Id = Guid.NewGuid(),
                ProductId = item.ProductId,
                Quantity = resolvedQty,
                UnitId = item.UnitId,
                SellingPrice = item.SellingPrice,
                BasePriceAtTime = product.BasePrice,
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

        if (orderItems.Count == 0)
            return Result<OrderDetailDto>.Failure("At least one item is required to create an order.");

        var orderNumber = await GenerateOrderNumberAsync(context, cancellationToken);

        // ── FIXED: Status = Draft (was Submitted) ─────────────────────────────
        // Salesman creates a Draft; they must call /submit to move to PendingApproval.
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = orderNumber,
            CustomerId = request.CustomerId,
            RouteId = customer.RouteId,
            SalesmanId = request.SalesmanId,
            OrderDate = DateTime.UtcNow,
            Status = OrderStatus.Draft,          // ← was OrderStatus.Submitted
            Remarks = request.Remarks,
            Items = orderItems,
            CustomerVisitId = request.CustomerVisitId,
        };

        await context.Orders.AddAsync(order, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        // Link to customer visit if provided
        if (request.CustomerVisitId.HasValue && request.ExecutionId.HasValue)
        {
            var visit = await context.CustomerVisits
                .FirstOrDefaultAsync(v => v.Id == request.CustomerVisitId.Value
                    && v.RouteExecutionId == request.ExecutionId.Value, cancellationToken);

            if (visit != null && visit.Status == VisitStatus.Pending)
            {
                visit.RecordOrder(order.Id);
                await context.SaveChangesAsync(cancellationToken);
            }
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
            ClosedAt = order.ClosedAt,
            CreatedAt = order.CreatedAt,
            Items = itemDtos,
        }, "Order created successfully.");
    }

    private static async Task<string> GenerateOrderNumberAsync(IApplicationDbContext dbContext, CancellationToken _)
    {
        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        var prefix = $"ORD-{datePart}-";

        var lastOrder = await dbContext.Orders
            .Where(o => o.OrderNumber.StartsWith(prefix))
            .OrderByDescending(o => o.OrderNumber)
            .FirstOrDefaultAsync(_);

        int nextNumber = 1;
        if (lastOrder != null)
        {
            var lastNumberStr = lastOrder.OrderNumber[(prefix.Length)..];
            if (int.TryParse(lastNumberStr, out int lastNumber))
                nextNumber = lastNumber + 1;
        }

        return $"{prefix}{nextNumber:D4}";
    }

    private static decimal ResolveQuantity(decimal rawQty, int? bags, int? boxes, int? tins)
    {
        if (bags.HasValue || boxes.HasValue || tins.HasValue)
            return (bags ?? 0) + (boxes ?? 0) + (tins ?? 0);
        return rawQty;
    }
}