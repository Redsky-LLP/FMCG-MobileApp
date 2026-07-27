// PATH: src/FMCG.Distribution.Application/Features/Orders/Queries/GetCustomerOrderHistoryQueryHandler.cs
// FIXED: ProductName/ProductNameMalayalam now prefer the ProductNameAtTime/ProductNameMalayalamAtTime
//        snapshot captured at order-creation time, same fix as GetOrderByIdQueryHandler and
//        GetOrdersByRouteQueryHandler — this handler had the identical live-join bug, so a
//        customer's order history would silently show a renamed product's current name instead
//        of what was actually ordered that day.

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
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId && !c.IsDeleted, cancellationToken);

        if (customer == null)
        {
            return Result<List<CustomerOrderHistoryDto>>.Failure("Customer not found.");
        }

        // Authorization: routes are open to any salesman by default (see
        // GetActiveRoutesQueryHandler) — only block if the customer's route is
        // permanently dedicated to a DIFFERENT specific salesman.
        if (!request.IsAdmin && request.SalesmanId.HasValue)
        {
            var route = await _context.Routes
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == customer.RouteId && !r.IsDeleted, cancellationToken);

            if (route != null && route.AssignedSalesmanId.HasValue && route.AssignedSalesmanId != request.SalesmanId.Value)
            {
                return Result<List<CustomerOrderHistoryDto>>.Failure("This route is permanently assigned to another salesman.");
            }
        }

        // Get completed orders (Submitted or Closed) for history
        // ── PERFORMANCE FIX: added .ThenInclude(i => i.Product) and .ThenInclude(i =>
        // i.Unit) here, so both are eagerly loaded in this ONE query alongside the
        // orders/items. Previously, every single item on every single order triggered
        // two brand-new database round-trips inside the nested loop below — for the
        // default 10-order history with ~5 items each, that was up to 100 sequential
        // round-trips just to open the Previous Orders popup. Across a cross-cloud
        // connection (app server and DB in different data centers), each round-trip
        // costs real time — this was likely the single biggest contributor to that
        // screen feeling slow to open. ──
        var orders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Unit)
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
                // ── Both already loaded above — no more per-item database calls. ──
                var product = item.Product;
                var unit = item.Unit;

                itemDtos.Add(new OrderHistoryItemDto
                {
                    ProductId = item.ProductId,
                    // ── Snapshot-first: shows what was actually on the order at the time it
                    // was placed, not whatever the product happens to be named right now. ──
                    ProductName = item.ProductNameAtTime ?? product?.NameEnglish ?? "Unknown",
                    ProductNameMalayalam = item.ProductNameMalayalamAtTime ?? product?.NameMalayalam,
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