// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/CreateOrderCommandHandler.cs
// FIX: Replaced SemaphoreSlim + SELECT-based order number generation with
//      PostgreSQL sequence (order_number_seq) via IApplicationDbContext.NextOrderSequenceAsync().
//      PostgreSQL sequences are atomic at the database level — no duplicate keys possible,
//      no race conditions, works correctly across multiple server instances.
// FIX: Unit lookup no longer requires IsActive - only checks IsDeleted
// NEW: Captures ProductNameAtTime / ProductNameMalayalamAtTime / SizeGroupNameAtTime on each
//      OrderItem at creation, mirroring the existing BasePriceAtTime snapshot pattern. This
//      is what keeps historical reports (Billing Sheet / Loading Sheet) showing the name and
//      size group that were actually on the order that day, even if the product gets renamed
//      or moved to a different size group later — including through a reopen + re-close cycle,
//      since this value is only ever set here at creation and never overwritten afterwards.

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

        // ── PERFORMANCE FIX: previously, every item in the request triggered two
        // separate database round-trips (one for its Product, one for its Unit) —
        // an order with 10 items meant 20 sequential round-trips before the order
        // was even created. This is exactly the delay you're seeing when opening
        // a brand-new order screen and it appears empty while still loading, and
        // again on save. Fetching every distinct referenced product and unit in
        // TWO queries up front, then looking each one up from an in-memory
        // dictionary inside the loop, turns that into 2 round-trips total
        // regardless of how many items are on the order. Across a cross-cloud
        // connection (app server and DB in different data centers), each
        // round-trip costs real time — this was likely the single biggest
        // contributor to the salesman-side delay reported. ──
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

            // ── NEW: Out of Stock guard — a salesman shouldn't be able to place a fresh
            // order for something the admin has marked as out of stock, even if a stale
            // client screen still shows it. This mirrors the existing inactive/deleted
            // checks above — same kind of "this can't be ordered right now" rule. ──
            if (product.IsOutOfStock)
                return Result<OrderDetailDto>.Failure($"'{product.NameEnglish}' is currently out of stock.");

            var resolvedQty = ResolveQuantity(item.Quantity, item.QuantityBags, item.QuantityBoxes, item.QuantityTins);
            if (resolvedQty <= 0)
                return Result<OrderDetailDto>.Failure($"Quantity must be greater than zero for '{product.NameEnglish}'.");

            if (item.SellingPrice <= 0)
                return Result<OrderDetailDto>.Failure($"Selling price must be greater than zero for '{product.NameEnglish}'.");

            // ── FIX: no longer require IsActive here. A packing category being
            // deactivated (e.g. via AdminCatalogConfig) is meant to hide it from NEW
            // product assignments — it should NOT retroactively break orders for
            // products that are already linked to it. Only IsDeleted disqualifies a
            // unit, since a hard-deleted unit genuinely no longer exists. ──
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
                // ── NEW: name/size-group snapshot, captured once, right here ──
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

        // ── FIX: Allow orders with only remarks (no items) ──
        // If there are no items but remarks exist, create an order with empty items list
        if (orderItems.Count == 0 && string.IsNullOrWhiteSpace(request.Remarks))
        {
            return Result<OrderDetailDto>.Failure("Add at least one product or retail remark to create an order.");
        }

        // ── BUG FIX: OrderDate used to always be DateTime.UtcNow — the exact
        // moment Save was clicked, completely regardless of which route
        // execution this order actually belongs to. This broke the case of a
        // customer missed on the original route day (e.g. Saturday) and only
        // filled in later (e.g. Monday, after a Sunday gap) — the order would
        // get stamped with Monday's date instead of the Saturday route's real
        // date, even though editing an already-existing order always correctly
        // preserved its original date (UpdateOrderCommandHandler never touches
        // OrderDate at all). New orders now resolve the same way: find the
        // route execution this order belongs to FIRST, and stamp OrderDate from
        // its ExecutionDate — falling back to "now" only if no execution
        // context can be resolved at all (should be rare, since every order is
        // tied to a route that always operates through an execution). ──
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

        // ── FIX: Duplicate-order guard — a visit already carrying an OrderId means an
        // order was already created for this customer's stop (e.g. a double-tap/retry
        // from the salesman app produced two CreateOrder calls back to back). Without
        // this check, nothing stopped a second, fully independent Order row from being
        // created for the same visit, and once both got closed they'd both legitimately
        // show up as separate stops on the Loading Sheet and Billing Sheet. Only blocks
        // when the visit is already linked to a real order — a visit with no OrderId yet
        // is unaffected. ──
        if (visit != null && visit.OrderId.HasValue)
        {
            return Result<OrderDetailDto>.Failure("An order already exists for this visit.");
        }

        // ── Generate unique order number via PostgreSQL sequence ───────────────
        // nextval('order_number_seq') is atomic — the DB guarantees each call
        // returns a unique value, even with thousands of concurrent requests.
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
        await context.SaveChangesAsync(cancellationToken);

        // ── Mark the visit as ordered, now that the order exists ──
        // (Visit/execution already resolved above — no need to re-look it up here.)
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

    // ── Generate order number using PostgreSQL atomic sequence ─────────────────
    // Format: ORD-YYYYMMDD-NNNN  (e.g. ORD-20260616-1042)
    // The sequence value is globally unique across all dates, so we combine it
    // with the date prefix for human readability.
    // Even if the sequence wraps across days, the date prefix ensures no collisions.
    private async Task<string> GenerateOrderNumberAsync(CancellationToken cancellationToken)
    {
        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");

        // This single DB call is atomic — PostgreSQL guarantees uniqueness
        var seqValue = await context.NextOrderSequenceAsync(cancellationToken);

        // Format: ORD-20260616-1042
        // Use seqValue directly (no date-based reset) to keep it globally unique
        return $"ORD-{datePart}-{seqValue:D4}";
    }

    private static decimal ResolveQuantity(decimal rawQty, int? bags, int? boxes, int? tins)
    {
        if (bags.HasValue || boxes.HasValue || tins.HasValue)
            return (bags ?? 0) + (boxes ?? 0) + (tins ?? 0);
        return rawQty;
    }
}