using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Reports.Queries;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class ReportsController(IMediator mediator) : ControllerBase
{
    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/reports/loading-sheet
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("loading-sheet")]
    [Authorize(Roles = "Warehouse,Admin,SuperAdmin,Salesman")]   // ← Added Salesman
    public async Task<IActionResult> GetLoadingSheet(
        [FromQuery] Guid? routeId,
        [FromQuery] DateTime? date)
    {
        var query = new GetLoadingSheetQuery
        {
            RouteId = routeId,
            Date = date
        };

        var result = await mediator.Send(query);

        if (!result.IsSuccess)
        {
            return BadRequest(new { error = result.Error });
        }

        var fileName = $"LoadingSheet_{date:yyyyMMdd}.pdf";
        if (routeId.HasValue)
        {
            fileName = $"LoadingSheet_Route{routeId}_{date:yyyyMMdd}.pdf";
        }

        return File(result.Data!, "application/pdf", fileName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/reports/billing-sheet
    // Roles: Accounts, Admin, SuperAdmin
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("billing-sheet")]
    [Authorize(Roles = "Accounts,Admin,SuperAdmin")]
    public async Task<IActionResult> GetBillingSheet(
        [FromQuery] Guid? routeId,
        [FromQuery] DateTime? date)
    {
        var query = new GetBillingSheetQuery
        {
            RouteId = routeId,
            Date = date
        };

        var result = await mediator.Send(query);

        if (!result.IsSuccess)
        {
            return BadRequest(new { error = result.Error });
        }

        var fileName = $"BillingSheet_{date:yyyyMMdd}.pdf";
        if (routeId.HasValue)
        {
            fileName = $"BillingSheet_Route{routeId}_{date:yyyyMMdd}.pdf";
        }

        return File(result.Data!, "application/pdf", fileName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/reports/route-summary
    // Roles: Admin, SuperAdmin
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("route-summary")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> GetRouteSummary(
        [FromQuery] Guid? routeId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var query = new GetRouteSummaryReportQuery
        {
            RouteId = routeId,
            FromDate = fromDate,
            ToDate = toDate
        };

        var result = await mediator.Send(query);

        if (!result.IsSuccess)
        {
            return BadRequest(new { error = result.Error });
        }

        var fromDateStr = fromDate?.ToString("yyyyMMdd") ?? "30days";
        var toDateStr = toDate?.ToString("yyyyMMdd") ?? DateTime.UtcNow.ToString("yyyyMMdd");
        var fileName = $"RouteSummary_{fromDateStr}_to_{toDateStr}.pdf";

        if (routeId.HasValue)
        {
            fileName = $"RouteSummary_Route{routeId}_{fromDateStr}_to_{toDateStr}.pdf";
        }

        return File(result.Data!, "application/pdf", fileName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/reports/product-summary
    // Roles: Admin, SuperAdmin
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("product-summary")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> GetProductSummary(
        [FromQuery] Guid? productGroupId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var query = new GetProductSummaryReportQuery
        {
            ProductGroupId = productGroupId,
            FromDate = fromDate,
            ToDate = toDate
        };

        var result = await mediator.Send(query);

        if (!result.IsSuccess)
        {
            return BadRequest(new { error = result.Error });
        }

        var fromDateStr = fromDate?.ToString("yyyyMMdd") ?? "30days";
        var toDateStr = toDate?.ToString("yyyyMMdd") ?? DateTime.UtcNow.ToString("yyyyMMdd");
        var fileName = $"ProductSummary_{fromDateStr}_to_{toDateStr}.pdf";

        if (productGroupId.HasValue)
        {
            fileName = $"ProductSummary_Group{productGroupId}_{fromDateStr}_to_{toDateStr}.pdf";
        }

        return File(result.Data!, "application/pdf", fileName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/reports/daily-summary
    // Roles: Admin, SuperAdmin, Accounts
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("daily-summary")]
    [Authorize(Roles = "Admin,SuperAdmin,Accounts")]
    public async Task<IActionResult> GetDailySummary(
        [FromQuery] DateTime? date)
    {
        var query = new GetDailySummaryReportQuery
        {
            Date = date
        };

        var result = await mediator.Send(query);

        if (!result.IsSuccess)
        {
            return BadRequest(new { error = result.Error });
        }

        var targetDate = date?.ToString("yyyyMMdd") ?? DateTime.UtcNow.ToString("yyyyMMdd");
        var fileName = $"DailySummary_{targetDate}.pdf";

        return File(result.Data!, "application/pdf", fileName);
    }
}