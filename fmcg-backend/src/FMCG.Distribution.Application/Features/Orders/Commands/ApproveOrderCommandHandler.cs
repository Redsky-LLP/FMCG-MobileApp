// ApproveOrderCommandHandler.cs - Should be a single class implementation
using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Orders.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class ApproveOrderCommandHandler(IApplicationDbContext context)
    : IRequestHandler<ApproveOrderCommand, Result<OrderDetailDto>>
{
    public async Task<Result<OrderDetailDto>> Handle(
        ApproveOrderCommand request,
        CancellationToken cancellationToken)
    {
        // Verify caller is Admin / SuperAdmin
        var admin = await context.Users
            .FirstOrDefaultAsync(
                u => u.Id == request.AdminId && u.IsActive,
                cancellationToken);

        if (admin == null || (admin.Role != UserRole.Admin && admin.Role != UserRole.SuperAdmin))
            return Result<OrderDetailDto>.Failure("Only Admin or SuperAdmin can approve orders.");

        var order = await context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == request.Id && !o.IsDeleted, cancellationToken);

        if (order == null)
            return Result<OrderDetailDto>.Failure("Order not found.");

        // Only PendingApproval orders can be approved
        if (order.Status != OrderStatus.PendingApproval)
            return Result<OrderDetailDto>.Failure(
                $"Cannot approve order in '{order.Status}' status. Only PendingApproval orders can be approved.");

        // Transition: PendingApproval → Approved
        order.Status = OrderStatus.Approved;
        order.ApprovedAt = DateTime.UtcNow;
        order.ApprovedBy = request.AdminId;
        order.MarkModified(request.AdminId.ToString());

        await context.SaveChangesAsync(cancellationToken);

        // Build response DTO
        var customer = await context.Customers
            .FirstOrDefaultAsync(c => c.Id == order.CustomerId && !c.IsDeleted, cancellationToken);

        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == order.RouteId && !r.IsDeleted, cancellationToken);

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
            ApprovedAt = order.ApprovedAt,
            ClosedAt = order.ClosedAt,
            CreatedAt = order.CreatedAt,
            Items = itemDtos,
        };

        return Result<OrderDetailDto>.Success(resultDto, "Order approved successfully.");
    }
}