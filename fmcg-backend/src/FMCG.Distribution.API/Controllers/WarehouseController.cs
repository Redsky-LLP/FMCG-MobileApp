// PATH: src/FMCG.Distribution.API/Controllers/WarehouseController.cs
// ADD these missing using directives at the top:

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;  // ← ADD THIS (fixes EF and DbSet errors)
using System.Security.Claims;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

// Rest of the file remains the same...

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize(Roles = "Warehouse,Admin,SuperAdmin")]
public class WarehouseController(IApplicationDbContext context) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : Guid.Empty;

    // ── GET /api/v1/warehouse/orders/pending ──────────────────────────────────
    // Returns Approved orders awaiting packing (and Partially-packed)
    [HttpGet("orders/pending")]
    public async Task<ActionResult<Result<List<WarehouseOrderDto>>>> GetPendingOrders(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] Guid? routeId,
        [FromQuery] int? packingStatus,
        [FromQuery] string? search)
    {
        var from = (fromDate ?? DateTime.UtcNow.Date).Date;
        var to = (toDate ?? DateTime.UtcNow.Date.AddDays(1)).Date;

        var query = context.Orders
            .Include(o => o.Customer)
            .Include(o => o.Route)
            .Include(o => o.Salesman)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product)
            .Where(o =>
                !o.IsDeleted &&
                o.Status == OrderStatus.Approved &&   // Approved = ready for warehouse
                o.OrderDate.Date >= from &&
                o.OrderDate.Date <= to);

        if (routeId.HasValue)
            query = query.Where(o => o.RouteId == routeId.Value);

        if (packingStatus.HasValue)
            query = query.Where(o => (int)o.PackingStatus == packingStatus.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search}%";
            query = query.Where(o =>
                (o.Customer != null && EF.Functions.Like(o.Customer.NameEnglish, pattern)) ||
                (o.Salesman != null && EF.Functions.Like(o.Salesman.FullName, pattern)) ||
                EF.Functions.Like(o.OrderNumber, pattern));
        }

        var orders = await MapOrders(query);
        return Ok(Result<List<WarehouseOrderDto>>.Success(orders));
    }

    // ── GET /api/v1/warehouse/orders/closed ───────────────────────────────────
    // NEW: Returns Closed orders so warehouse can see yesterday's/last week's history
    [HttpGet("orders/closed")]
    public async Task<ActionResult<Result<List<WarehouseOrderDto>>>> GetClosedOrders(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] Guid? routeId,
        [FromQuery] string? search)
    {
        var from = (fromDate ?? DateTime.UtcNow.Date).Date;
        var to = (toDate ?? DateTime.UtcNow.Date.AddDays(1)).Date;

        var query = context.Orders
            .Include(o => o.Customer)
            .Include(o => o.Route)
            .Include(o => o.Salesman)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product)
            .Where(o =>
                !o.IsDeleted &&
                o.Status == OrderStatus.Closed &&
                o.OrderDate.Date >= from &&
                o.OrderDate.Date <= to);

        if (routeId.HasValue)
            query = query.Where(o => o.RouteId == routeId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search}%";
            query = query.Where(o =>
                (o.Customer != null && EF.Functions.Like(o.Customer.NameEnglish, pattern)) ||
                (o.Salesman != null && EF.Functions.Like(o.Salesman.FullName, pattern)) ||
                EF.Functions.Like(o.OrderNumber, pattern));
        }

        // Order by most recent first
        query = query.OrderByDescending(o => o.OrderDate);

        var orders = await MapOrders(query);
        return Ok(Result<List<WarehouseOrderDto>>.Success(orders));
    }

    // ── GET /api/v1/warehouse/orders/packing-status/{routeId} ────────────────
    [HttpGet("orders/packing-status/{routeId}")]
    [Authorize(Roles = "Salesman,Warehouse,Admin,SuperAdmin")]
    public async Task<ActionResult<Result<RoutePackingStatusDto>>> GetRoutePackingStatus(Guid routeId)
    {
        var today = DateTime.UtcNow.Date;

        var orders = await context.Orders
            .Where(o =>
                o.RouteId == routeId &&
                !o.IsDeleted &&
                o.Status == OrderStatus.Approved &&
                o.OrderDate.Date == today)
            .Select(o => new { o.Id, o.OrderNumber, o.PackingStatus })
            .ToListAsync();

        var dto = new RoutePackingStatusDto
        {
            TotalOrders = orders.Count,
            PackedCount = orders.Count(o => o.PackingStatus == PackingStatus.Packed),
            PendingCount = orders.Count(o => o.PackingStatus == PackingStatus.Pending),
            AllPacked = orders.Count > 0 && orders.All(o => o.PackingStatus == PackingStatus.Packed),
            Orders = orders.Select(o => new RoutePackingOrderDto
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                PackingStatus = (int)o.PackingStatus,
            }).ToList(),
        };

        return Ok(Result<RoutePackingStatusDto>.Success(dto));
    }

    // ── POST /api/v1/warehouse/orders/{orderId}/pack ──────────────────────────
    [HttpPost("orders/{orderId}/pack")]
    public async Task<ActionResult<Result<bool>>> PackOrder(
        Guid orderId,
        [FromBody] PackOrderRequest? body)
    {
        var order = await context.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && !o.IsDeleted);

        if (order == null)
            return NotFound(Result<bool>.Failure("Order not found."));

        if (order.Status != OrderStatus.Approved)
            return BadRequest(Result<bool>.Failure(
                $"Only Approved orders can be packed. This order is '{order.Status}'."));

        var status = body?.IsPartial == true
            ? PackingStatus.PartiallyPacked
            : PackingStatus.Packed;

        order.PackingStatus = status;
        order.PackedAt = DateTime.UtcNow;
        order.PackedByUserId = CurrentUserId;

        if (status == PackingStatus.Packed)
            order.Status = OrderStatus.Packed;

        await context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true,
            status == PackingStatus.Packed
                ? "Order marked as Packed."
                : "Order marked as Partially Packed."));
    }

    // ── POST /api/v1/warehouse/orders/bulk-pack ───────────────────────────────
    [HttpPost("orders/bulk-pack")]
    public async Task<ActionResult<Result<int>>> BulkPack([FromBody] BulkPackRequest request)
    {
        if (request.OrderIds == null || request.OrderIds.Count == 0)
            return BadRequest(Result<int>.Failure("No order IDs provided."));

        var orders = await context.Orders
            .Where(o => request.OrderIds.Contains(o.Id)
                     && !o.IsDeleted
                     && o.Status == OrderStatus.Approved)
            .ToListAsync();

        var packedAt = DateTime.UtcNow;
        var packerId = CurrentUserId;

        foreach (var order in orders)
        {
            order.PackingStatus = PackingStatus.Packed;
            order.Status = OrderStatus.Packed;
            order.PackedAt = packedAt;
            order.PackedByUserId = packerId;
        }

        await context.SaveChangesAsync();
        return Ok(Result<int>.Success(orders.Count, $"{orders.Count} order(s) marked as Packed."));
    }

    // ── GET /api/v1/warehouse/summary ─────────────────────────────────────────
    [HttpGet("summary")]
    public async Task<ActionResult<Result<WarehouseSummaryDto>>> GetSummary(
        [FromQuery] DateTime? date)
    {
        var d = (date ?? DateTime.UtcNow).Date;

        var approvedOrders = await context.Orders
            .Where(o => !o.IsDeleted
                     && o.Status == OrderStatus.Approved
                     && o.OrderDate.Date == d)
            .ToListAsync();

        return Ok(Result<WarehouseSummaryDto>.Success(new WarehouseSummaryDto
        {
            TotalOrders = approvedOrders.Count,
            PackedCount = approvedOrders.Count(o => o.PackingStatus == PackingStatus.Packed),
            PendingCount = approvedOrders.Count(o => o.PackingStatus == PackingStatus.Pending),
            PartialCount = approvedOrders.Count(o => o.PackingStatus == PackingStatus.PartiallyPacked),
        }));
    }

    // ── Helper: project orders to DTOs ───────────────────────────────────────
    // FIXED: .ToListAsync() on entities first, then project to DTO in memory.
    // Projecting to a DTO that contains a nested .ToList() inside a LINQ Select
    // cannot be translated to SQL by EF Core — causes runtime errors.
    private static async Task<List<WarehouseOrderDto>> MapOrders(IQueryable<FMCG.Distribution.Domain.Entities.Order> query)
    {
        var entities = await query
            .OrderBy(o => o.PackingStatus)
            .ThenBy(o => o.OrderDate)
            .ToListAsync();                     // ← execute SQL here, get entities

        return entities.Select(o => new WarehouseOrderDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            OrderDate = o.OrderDate,
            CustomerName = o.Customer?.NameEnglish ?? "—",
            SalesmanName = o.Salesman?.FullName ?? "—",
            RouteName = o.Route?.Name ?? "—",
            RouteId = o.RouteId,
            ItemCount = o.Items?.Count ?? 0,
            TotalQty = o.Items?.Sum(i => i.Quantity) ?? 0,
            PackingStatus = (int)o.PackingStatus,
            PackedAt = o.PackedAt,
            Items = o.Items?.Select(i => new WarehouseOrderItemDto
            {
                ProductId = i.ProductId,
                ProductName = i.Product?.NameEnglish ?? "Unknown",
                Quantity = i.Quantity,
                UnitName = i.Unit?.Name ?? "",
                QuantityBags = i.QuantityBags,
                QuantityBoxes = i.QuantityBoxes,
                QuantityTins = i.QuantityTins,
            }).ToList() ?? [],
        }).ToList();                             // ← in-memory projection
    }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────
public class WarehouseOrderDto
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string SalesmanName { get; set; } = string.Empty;
    public string RouteName { get; set; } = string.Empty;
    public Guid RouteId { get; set; }
    public int ItemCount { get; set; }
    public decimal TotalQty { get; set; }
    public int PackingStatus { get; set; }
    public DateTime? PackedAt { get; set; }
    public List<WarehouseOrderItemDto> Items { get; set; } = [];
}

public class WarehouseOrderItemDto
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public int? QuantityBags { get; set; }
    public int? QuantityBoxes { get; set; }
    public int? QuantityTins { get; set; }
}

public class WarehouseSummaryDto
{
    public int TotalOrders { get; set; }
    public int PackedCount { get; set; }
    public int PendingCount { get; set; }
    public int PartialCount { get; set; }
}

public class PackOrderRequest { public bool IsPartial { get; set; } }
public class BulkPackRequest { public List<Guid> OrderIds { get; set; } = []; }

public class RoutePackingStatusDto
{
    public int TotalOrders { get; set; }
    public int PackedCount { get; set; }
    public int PendingCount { get; set; }
    public bool AllPacked { get; set; }
    public List<RoutePackingOrderDto> Orders { get; set; } = [];
}

public class RoutePackingOrderDto
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public int PackingStatus { get; set; }
}