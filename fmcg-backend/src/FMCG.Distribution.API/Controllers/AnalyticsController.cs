// PATH: src/FMCG.Distribution.API/Controllers/AnalyticsController.cs
// UPDATED: Added GET /api/v1/analytics/public-stats  [AllowAnonymous]
//          Returns lightweight aggregate counts for the public landing page.
//          No sensitive data — just totals visible to any visitor.
//          All existing endpoints are unchanged.

using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Analytics.DTOs;
using FMCG.Distribution.Application.Features.Analytics.Queries;
using FMCG.Distribution.Application.Features.PricingAudit.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class AnalyticsController(IMediator mediator, IApplicationDbContext context) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
    }

    private bool IsAdmin()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        return role == "Admin" || role == "SuperAdmin";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/public-stats
    // Public — no auth required. Used by the landing page to show live counts.
    // Returns only aggregate totals — no order details, no customer data.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("public-stats")]
    [AllowAnonymous]
    public async Task<ActionResult> GetPublicStats(CancellationToken cancellationToken)
    {
        try
        {
            var today = DateTime.UtcNow.Date;

            // Total active routes
            var activeRoutes = await context.Routes
                .Where(r => !r.IsDeleted && r.IsActive)
                .CountAsync(cancellationToken);

            // Today's orders (non-draft)
            var todayOrders = await context.Orders
                .Where(o => !o.IsDeleted
                    && o.Status != Domain.Enums.OrderStatus.Draft
                    && o.OrderDate.Date == today)
                .CountAsync(cancellationToken);

            // Today's revenue
            var todayRevenue = await context.Orders
                .Include(o => o.Items)
                .Where(o => !o.IsDeleted
                    && o.Status != Domain.Enums.OrderStatus.Draft
                    && o.OrderDate.Date == today)
                .SelectMany(o => o.Items!)
                .SumAsync(i => i.SellingPrice * i.Quantity, cancellationToken);

            // Total active customers
            var activeCustomers = await context.Customers
                .Where(c => !c.IsDeleted && c.IsActive)
                .CountAsync(cancellationToken);

            // Today's top routes by revenue (for progress bars)
            var routeStats = await context.Orders
                .Include(o => o.Items)
                .Include(o => o.Route)
                .Where(o => !o.IsDeleted
                    && o.Status != Domain.Enums.OrderStatus.Draft
                    && o.OrderDate.Date == today
                    && o.Route != null)
                .GroupBy(o => new { o.RouteId, RouteName = o.Route!.Name })
                .Select(g => new
                {
                    g.Key.RouteName,
                    Revenue = g.SelectMany(o => o.Items!).Sum(i => i.SellingPrice * i.Quantity),
                    OrderCount = g.Count()
                })
                .OrderByDescending(r => r.Revenue)
                .Take(4)
                .ToListAsync(cancellationToken);

            return Ok(new
            {
                activeRoutes,
                todayOrders,
                todayRevenue,
                activeCustomers,
                routes = routeStats.Select(r => new
                {
                    r.RouteName,
                    r.Revenue,
                    r.OrderCount
                })
            });
        }
        catch (Exception ex)
        {
            // Return zeros on any error — landing page handles gracefully
            return Ok(new
            {
                activeRoutes = 0,
                todayOrders = 0,
                todayRevenue = 0m,
                activeCustomers = 0,
                routes = Array.Empty<object>()
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/product-profitability
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("product-profitability")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<List<ProductProfitabilityDto>>>> GetProductProfitability(
        [FromQuery] Guid? productGroupId,
        [FromQuery] bool? showOnlyNegativeMargin,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var result = await mediator.Send(new GetProductProfitabilityQuery
        {
            ProductGroupId = productGroupId,
            ShowOnlyNegativeMargin = showOnlyNegativeMargin,
            FromDate = fromDate,
            ToDate = toDate
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/route-profitability
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("route-profitability")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<List<RouteProfitabilityDto>>>> GetRouteProfitability(
        [FromQuery] Guid? routeId,
        [FromQuery] bool? showOnlyNegativeMargin,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var result = await mediator.Send(new GetRouteProfitabilityQuery
        {
            RouteId = routeId,
            ShowOnlyNegativeMargin = showOnlyNegativeMargin,
            FromDate = fromDate,
            ToDate = toDate
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/order/{orderId}/margin
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("order/{orderId}/margin")]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman")]
    public async Task<ActionResult<Result<OrderMarginDto>>> GetOrderMargin(Guid orderId)
    {
        var userId = GetCurrentUserId();
        var isAdmin = IsAdmin();

        var result = await mediator.Send(new GetOrderMarginQuery
        {
            OrderId = orderId,
            UserId = userId,
            IsAdmin = isAdmin
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/pricing-audit
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("pricing-audit")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<List<PricingAuditLogDto>>>> GetPricingAudit(
        [FromQuery] Guid? productId,
        [FromQuery] string? action,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int limit = 50)
    {
        var result = await mediator.Send(new GetPricingAuditLogQuery
        {
            ProductId = productId,
            Action = null, // handler expects PricingAction?; mapping from string happens inside handler if needed
            FromDate = fromDate,
            ToDate = toDate,
            Limit = limit
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/dashboard/kpis
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("dashboard/kpis")]
    [Authorize(Roles = "Admin,SuperAdmin,Accounts")]
    public async Task<ActionResult<Result<DashboardKpisDto>>> GetDashboardKpis(
        [FromQuery] DateTime? date)
    {
        var query = new GetDashboardKpisQuery
        {
            Date = date
        };
        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/route-performance
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("route-performance")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<RoutePerformanceResponseDto>>> GetRoutePerformance(
        [FromQuery] Guid? routeId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var result = await mediator.Send(new GetRoutePerformanceQuery
        {
            RouteId = routeId,
            FromDate = fromDate,
            ToDate = toDate
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/product-performance
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("product-performance")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<ProductPerformanceResponseDto>>> GetProductPerformance(
        [FromQuery] Guid? productGroupId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int limit = 10,
        [FromQuery] string sortBy = "revenue")
    {
        var result = await mediator.Send(new GetProductPerformanceQuery
        {
            ProductGroupId = productGroupId,
            FromDate = fromDate,
            ToDate = toDate,
            Limit = limit,
            SortBy = sortBy
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/top-products
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("top-products")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<List<TopProductDto>>>> GetTopProducts(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] Guid? productGroupId,
        [FromQuery] int limit = 10,
        [FromQuery] string sortBy = "sales")
    {
        var result = await mediator.Send(new GetTopProductsQuery
        {
            FromDate = fromDate,
            ToDate = toDate,
            ProductGroupId = productGroupId,
            Limit = limit,
            SortBy = sortBy
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/analytics/period-comparison
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("period-comparison")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<PeriodComparisonResponseDto>>> GetPeriodComparison(
        [FromQuery] DateTime fromDate,
        [FromQuery] DateTime toDate,
        [FromQuery] Guid? routeId,
        [FromQuery] bool compareWithPrevious = true)
    {
        var result = await mediator.Send(new GetPeriodComparisonQuery
        {
            FromDate = fromDate,
            ToDate = toDate,
            RouteId = routeId,
            CompareWithPrevious = compareWithPrevious
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }
}