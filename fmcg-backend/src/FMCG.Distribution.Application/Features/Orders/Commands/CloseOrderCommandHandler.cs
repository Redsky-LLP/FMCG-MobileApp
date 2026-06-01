// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/CloseOrderCommandHandler.cs
// FIXED: OrderStatus.Submitted no longer exists.
//        Close is now allowed from Approved or Packed status (matching Order.cs domain method).

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Orders.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class CloseOrderCommandHandler : IRequestHandler<CloseOrderCommand, Result<OrderDetailDto>>
{
    private readonly IApplicationDbContext _context;

    public CloseOrderCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<OrderDetailDto>> Handle(CloseOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == request.Id && !o.IsDeleted, cancellationToken);

        if (order == null)
            return Result<OrderDetailDto>.Failure("Order not found.");

        // Verify admin role
        var admin = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == request.AdminId && u.IsActive, cancellationToken);

        if (admin == null || (admin.Role != UserRole.Admin && admin.Role != UserRole.SuperAdmin))
            return Result<OrderDetailDto>.Failure("Only Admin or SuperAdmin can close orders.");

        // ── FIXED: was OrderStatus.Submitted — now Approved or Packed ─────────
        if (order.Status != OrderStatus.Approved && order.Status != OrderStatus.Packed)
            return Result<OrderDetailDto>.Failure(
                $"Cannot close order in '{order.Status}' status. Only Approved or Packed orders can be closed.");

        // Use domain method — it validates internally and sets status + timestamp
        order.Close();

        await _context.SaveChangesAsync(cancellationToken);

        // Build response DTO
        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == order.CustomerId && !c.IsDeleted, cancellationToken);

        var route = await _context.Routes
            .FirstOrDefaultAsync(r => r.Id == order.RouteId && !r.IsDeleted, cancellationToken);

        var itemDtos = new List<OrderItemDto>();
        foreach (var item in order.Items ?? [])
        {
            var product = await _context.Products
                .FirstOrDefaultAsync(p => p.Id == item.ProductId, cancellationToken);
            var unit = await _context.ProductUnits
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
            ApprovedAt = order.ApprovedAt,
            ClosedAt = order.ClosedAt,
            CreatedAt = order.CreatedAt,
            Items = itemDtos,
        }, "Order closed successfully.");
    }
}