using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Analytics.DTOs;
using FMCG.Distribution.Application.Features.Analytics.Queries;
using FMCG.Distribution.Application.Features.PricingAudit.Queries;
using FMCG.Distribution.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class AnalyticsController(IMediator mediator) : ControllerBase
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
        [FromQuery] int? limit = 100)
    {
        PricingAction? actionEnum = null;
        if (!string.IsNullOrEmpty(action))
        {
            if (Enum.TryParse<PricingAction>(action, true, out var parsed))
            {
                actionEnum = parsed;
            }
        }

        var result = await mediator.Send(new GetPricingAuditLogQuery
        {
            ProductId = productId,
            Action = actionEnum,
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
        var query = new GetRoutePerformanceQuery
        {
            RouteId = routeId,
            FromDate = fromDate,
            ToDate = toDate
        };
        var result = await mediator.Send(query);
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
        [FromQuery] int? limit = 50,
        [FromQuery] string? sortBy = "sales")
    {
        var query = new GetProductPerformanceQuery
        {
            ProductGroupId = productGroupId,
            FromDate = fromDate,
            ToDate = toDate,
            Limit = limit,
            SortBy = sortBy
        };
        var result = await mediator.Send(query);
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
        var query = new GetTopProductsQuery
        {
            Limit = limit,
            SortBy = sortBy,
            FromDate = fromDate,
            ToDate = toDate,
            ProductGroupId = productGroupId
        };
        var result = await mediator.Send(query);
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
        [FromQuery] bool compareWithPrevious = true,
        [FromQuery] Guid? routeId = null)
    {
        var query = new GetPeriodComparisonQuery
        {
            FromDate = fromDate,
            ToDate = toDate,
            CompareWithPrevious = compareWithPrevious,
            RouteId = routeId
        };
        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }
}