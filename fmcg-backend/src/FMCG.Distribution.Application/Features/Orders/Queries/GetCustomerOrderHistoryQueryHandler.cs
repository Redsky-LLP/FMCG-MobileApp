using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Orders.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Orders.Queries;

public class GetCustomerOrderHistoryQueryHandler : IRequestHandler<GetCustomerOrderHistoryQuery, Result<List<CustomerOrderHistoryDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetCustomerOrderHistoryQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<CustomerOrderHistoryDto>>> Handle(GetCustomerOrderHistoryQuery request, CancellationToken cancellationToken)
    {
        // Verify customer exists
        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId && !c.IsDeleted, cancellationToken);

        if (customer == null)
        {
            return Result<List<CustomerOrderHistoryDto>>.Failure("Customer not found.");
        }

        // Authorization: Salesman can only view customers on their assigned route
        if (!request.IsAdmin && request.SalesmanId.HasValue)
        {
            var route = await _context.Routes
                .FirstOrDefaultAsync(r => r.Id == customer.RouteId && r.AssignedSalesmanId == request.SalesmanId.Value && !r.IsDeleted, cancellationToken);

            if (route == null)
            {
                return Result<List<CustomerOrderHistoryDto>>.Failure("You are not authorized to view orders for this customer.");
            }
        }

        // Get completed orders (Submitted or Closed) for history
        var orders = await _context.Orders
            .Include(o => o.Items)
            .Where(o => o.CustomerId == request.CustomerId && !o.IsDeleted && o.Status != OrderStatus.Draft)
            .OrderByDescending(o => o.OrderDate)
            .Take(request.Limit)
            .ToListAsync(cancellationToken);

        var result = new List<CustomerOrderHistoryDto>();

        foreach (var order in orders)
        {
            var itemDtos = new List<OrderHistoryItemDto>();
            foreach (var item in order.Items ?? [])
            {
                var product = await _context.Products
                    .FirstOrDefaultAsync(p => p.Id == item.ProductId, cancellationToken);
                var unit = await _context.ProductUnits
                    .FirstOrDefaultAsync(u => u.Id == item.UnitId, cancellationToken);

                itemDtos.Add(new OrderHistoryItemDto
                {
                    ProductId = item.ProductId,
                    ProductName = product?.NameEnglish ?? "Unknown",
                    ProductNameMalayalam = product?.NameMalayalam,
                    Quantity = item.Quantity,
                    UnitSymbol = unit?.Symbol ?? "",
                    // ── new fields ────────────────────────────────────────────
                    SellingPrice = item.SellingPrice,
                    QuantityBags = item.QuantityBags,
                    QuantityBoxes = item.QuantityBoxes,
                    QuantityTins = item.QuantityTins,
                    // ─────────────────────────────────────────────────────────
                });
            }

            result.Add(new CustomerOrderHistoryDto
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                OrderDate = order.OrderDate,
                Status = order.Status.ToString(),
                TotalAmount = order.Items?.Sum(i => i.Quantity * i.SellingPrice) ?? 0,  // ← ADD
                Items = itemDtos,
            });
        }

        return Result<List<CustomerOrderHistoryDto>>.Success(result);
    }
}