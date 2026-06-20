// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/SubmitOrderCommandHandler.cs
// COMPLETE FIX: Auto-completes RouteExecution when all orders for the route are submitted.

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

        // ── Draft → PendingApproval ──
        order.Status = OrderStatus.PendingApproval;
        order.SubmittedAt = DateTime.UtcNow;
        order.MarkModified(request.SalesmanId.ToString());

        await context.SaveChangesAsync(cancellationToken);

        // ── CRITICAL FIX: Auto-complete RouteExecution if ALL orders for today are submitted ──
        await AutoCompleteRouteExecutionIfAllSubmitted(order.RouteId, cancellationToken);

        // ── Build response DTO ──
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

    /// <summary>
    /// Auto-completes the RouteExecution when ALL orders for this route today are submitted.
    /// This prevents the "active route execution" blocking issue.
    /// </summary>
    private async Task AutoCompleteRouteExecutionIfAllSubmitted(Guid routeId, CancellationToken cancellationToken)
    {
        try
        {
            var today = DateTime.UtcNow.Date;

            // ── Get ALL orders for this route today ──
            var allOrders = await context.Orders
                .Where(o => o.RouteId == routeId
                    && o.OrderDate.Date == today
                    && !o.IsDeleted)
                .ToListAsync(cancellationToken);

            // If no orders, nothing to do
            if (allOrders.Count == 0)
                return;

            // ── Check if there are ANY draft orders ──
            var hasDraftOrders = allOrders.Any(o => o.Status == OrderStatus.Draft);
            var hasSubmittedOrders = allOrders.Any(o => o.Status != OrderStatus.Draft);

            // ── If there are submitted orders AND no drafts, auto-complete ──
            if (hasSubmittedOrders && !hasDraftOrders)
            {
                // Find the active RouteExecution for this route today
                var execution = await context.RouteExecutions
                    .FirstOrDefaultAsync(e => e.RouteId == routeId
                        && e.ExecutionDate.Date == today
                        && e.Status == ExecutionStatus.InProgress
                        && !e.IsDeleted,
                        cancellationToken);

                if (execution != null)
                {
                    // ── Complete the execution ──
                    execution.Status = ExecutionStatus.Completed;
                    execution.CompletedAt = DateTime.UtcNow;
                    execution.UpdatedAt = DateTime.UtcNow;
                    execution.UpdatedBy = "system";

                    await context.SaveChangesAsync(cancellationToken);

                    Console.WriteLine($"[Auto-Complete] RouteExecution {execution.Id} auto-completed for route {routeId}. All {allOrders.Count} orders submitted.");
                }
                else
                {
                    // Try to find any execution (including Draft) and complete it
                    var anyExecution = await context.RouteExecutions
                        .FirstOrDefaultAsync(e => e.RouteId == routeId
                            && e.ExecutionDate.Date == today
                            && !e.IsDeleted
                            && (e.Status == ExecutionStatus.InProgress || e.Status == ExecutionStatus.Draft),
                            cancellationToken);

                    if (anyExecution != null)
                    {
                        anyExecution.Status = ExecutionStatus.Completed;
                        anyExecution.CompletedAt = DateTime.UtcNow;
                        anyExecution.UpdatedAt = DateTime.UtcNow;
                        anyExecution.UpdatedBy = "system";

                        await context.SaveChangesAsync(cancellationToken);

                        Console.WriteLine($"[Auto-Complete] RouteExecution {anyExecution.Id} auto-completed from {anyExecution.Status} for route {routeId}.");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            // ── Non-blocking: If auto-complete fails, don't fail the order submission ──
            Console.WriteLine($"[Auto-Complete] Failed to auto-complete RouteExecution for route {routeId}: {ex.Message}");
        }
    }
}