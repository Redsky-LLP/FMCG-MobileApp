// PATH: src/FMCG.Distribution.API/Controllers/OrdersController.cs
// UPDATED:
//  • POST /{id}/submit  → now salesman-only; sets PendingApproval
//  • POST /{id}/approve → new admin-only endpoint; sets Approved
//  • GET  /admin/pending-approval → admin list of PendingApproval orders (FIXED: includes items)
//  • GET  /admin/pending-approval/count → badge count helper

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Orders.Commands;
using FMCG.Distribution.Application.Features.Orders.DTOs;
using FMCG.Distribution.Application.Features.Orders.Queries;
using FMCG.Distribution.Domain.Enums;
using System.Security.Claims;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class OrdersController(IMediator mediator, IApplicationDbContext context) : ControllerBase
{
    // ── Helpers ───────────────────────────────────────────────────────────────
    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }

    private bool IsAdmin()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        return role is "Admin" or "SuperAdmin";
    }

    private bool IsSalesman() =>
        User.FindFirst(ClaimTypes.Role)?.Value == "Salesman";

    // ── GET /api/v1/orders/route/{routeId} ────────────────────────────────────
    [HttpGet("route/{routeId}")]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman")]
    public async Task<ActionResult<Result<List<OrderDto>>>> GetOrdersByRoute(
        Guid routeId,
        [FromQuery] OrderStatus? status)
    {
        var result = await mediator.Send(new GetOrdersByRouteQuery
        {
            RouteId = routeId,
            SalesmanId = IsSalesman() && !IsAdmin() ? GetCurrentUserId() : null,
            Status = status
        });

        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── GET /api/v1/orders/{id} ───────────────────────────────────────────────
    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman")]
    public async Task<ActionResult<Result<OrderDetailDto>>> GetOrderById(Guid id)
    {
        var result = await mediator.Send(new GetOrderByIdQuery
        {
            Id = id,
            SalesmanId = GetCurrentUserId(),
            IsAdmin = IsAdmin()
        });

        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── GET /api/v1/orders/customer/{customerId}/history ─────────────────────
    [HttpGet("customer/{customerId}/history")]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman")]
    public async Task<ActionResult<Result<List<CustomerOrderHistoryDto>>>> GetCustomerHistory(
        Guid customerId,
        [FromQuery] int limit = 10)
    {
        var result = await mediator.Send(new GetCustomerOrderHistoryQuery
        {
            CustomerId = customerId,
            SalesmanId = GetCurrentUserId(),
            IsAdmin = IsAdmin(),
            Limit = limit
        });

        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── POST /api/v1/orders ───────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "Salesman")]
    public async Task<ActionResult<Result<OrderDetailDto>>> CreateOrder(
        [FromBody] CreateOrderCommand command)
    {
        command.SalesmanId = GetCurrentUserId();
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── PUT /api/v1/orders/{id} ───────────────────────────────────────────────
    // Salesman: can only edit Draft orders they own.
    // Admin   : can edit Draft or PendingApproval orders.
    [HttpPut("{id}")]
    [Authorize(Roles = "Salesman,Admin,SuperAdmin")]
    public async Task<ActionResult<Result<OrderDetailDto>>> UpdateOrder(
        Guid id,
        [FromBody] UpdateOrderCommand command)
    {
        if (id != command.Id)
            return BadRequest(Result<OrderDetailDto>.Failure("ID mismatch"));

        command.SalesmanId = GetCurrentUserId();
        command.IsAdmin = IsAdmin();

        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── POST /api/v1/orders/{id}/submit ──────────────────────────────────────
    // Salesman submits their Draft order → PendingApproval
    [HttpPost("{id}/submit")]
    [Authorize(Roles = "Salesman")]
    public async Task<ActionResult<Result<OrderDetailDto>>> SubmitOrder(Guid id)
    {
        var result = await mediator.Send(new SubmitOrderCommand
        {
            Id = id,
            SalesmanId = GetCurrentUserId()
        });

        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── POST /api/v1/orders/{id}/approve ─────────────────────────────────────
    // Admin approves a PendingApproval order → Approved
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<OrderDetailDto>>> ApproveOrder(Guid id)
    {
        var result = await mediator.Send(new ApproveOrderCommand
        {
            Id = id,
            AdminId = GetCurrentUserId()
        });

        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── POST /api/v1/orders/{id}/close ───────────────────────────────────────
    [HttpPost("{id}/close")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<OrderDetailDto>>> CloseOrder(Guid id)
    {
        var result = await mediator.Send(new CloseOrderCommand
        {
            Id = id,
            AdminId = GetCurrentUserId()
        });

        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── DELETE /api/v1/orders/{id} ────────────────────────────────────────────
    [HttpDelete("{id}")]
    [Authorize(Roles = "Salesman")]
    public async Task<ActionResult<Result<bool>>> DeleteOrder(Guid id)
    {
        var result = await mediator.Send(new DeleteOrderCommand
        {
            Id = id,
            SalesmanId = GetCurrentUserId()
        });

        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── GET /api/v1/orders/admin/pending-approval ────────────────────────────
    // Returns all PendingApproval orders with FULL item details, filtered by routeId / date.
    [HttpGet("admin/pending-approval")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<List<OrderDto>>>> GetPendingApprovalOrders(
        [FromQuery] Guid? routeId,
        [FromQuery] DateTime? date)
    {
        var d = (date ?? DateTime.UtcNow).Date;

        var query = context.Orders
            .Include(o => o.Customer)
            .Include(o => o.Route)
            .Include(o => o.Salesman)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Product)
            .Include(o => o.Items!)
                .ThenInclude(i => i.Unit)
            .Where(o => !o.IsDeleted
                     && o.Status == OrderStatus.PendingApproval
                     && o.OrderDate.Date == d);

        if (routeId.HasValue)
            query = query.Where(o => o.RouteId == routeId.Value);

        var orders = await query
            .OrderBy(o => o.OrderDate)
            .ToListAsync();

        var dtos = orders.Select(o => new OrderDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            CustomerId = o.CustomerId,
            CustomerName = o.Customer?.NameEnglish,
            CustomerNameMalayalam = o.Customer?.NameMalayalam,
            RouteId = o.RouteId,
            RouteName = o.Route?.Name,
            SalesmanId = o.SalesmanId,
            SalesmanName = o.Salesman?.FullName,
            Status = o.Status,
            OrderDate = o.OrderDate,
            TotalAmount = o.Items?.Sum(i => i.SellingPrice * i.Quantity) ?? 0,
            TotalQuantity = o.Items?.Sum(i => i.Quantity) ?? 0,
            ItemCount = o.Items?.Count ?? 0,
            Remarks = o.Remarks,
            Items = o.Items?.Select(i => new OrderItemDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                ProductName = i.Product?.NameEnglish ?? string.Empty,
                Quantity = i.Quantity,
                SellingPrice = i.SellingPrice,
                UnitSymbol = i.Unit?.Symbol ?? string.Empty,
                QuantityBags = i.QuantityBags,
                QuantityBoxes = i.QuantityBoxes,
                QuantityTins = i.QuantityTins,
            }).ToList() ?? new List<OrderItemDto>()
        }).ToList();

        return Ok(Result<List<OrderDto>>.Success(dtos));
    }

    // ── GET /api/v1/orders/admin/pending-approval/count ──────────────────────
    // Lightweight badge-count endpoint — no heavy includes needed.
    [HttpGet("admin/pending-approval/count")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<int>>> GetPendingApprovalCount()
    {
        var today = DateTime.UtcNow.Date;
        var count = await context.Orders
            .CountAsync(o =>
                !o.IsDeleted &&
                o.Status == OrderStatus.PendingApproval &&
                o.OrderDate.Date == today);

        return Ok(Result<int>.Success(count));
    }
}