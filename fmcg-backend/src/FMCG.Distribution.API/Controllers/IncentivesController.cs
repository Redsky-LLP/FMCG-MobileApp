using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Analytics.Queries;
using FMCG.Distribution.Application.Features.Incentives.Commands;
using FMCG.Distribution.Application.Features.Incentives.DTOs;
using FMCG.Distribution.Application.Features.Incentives.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class IncentivesController(IMediator mediator) : ControllerBase
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
    // POST /api/v1/incentives/product
    // Roles: Admin, SuperAdmin
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("product")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<CreateProductIncentiveResponse>>> CreateProductIncentive(
        [FromBody] CreateProductIncentiveCommand command)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
        {
            return BadRequest(Result<CreateProductIncentiveResponse>.Failure("User not authenticated."));
        }

        command.AdminId = userId;
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/v1/incentives/product/{id}
    // Roles: Admin, SuperAdmin
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPut("product/{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<UpdateProductIncentiveResponse>>> UpdateProductIncentive(
        Guid id,
        [FromBody] UpdateProductIncentiveCommand command)
    {
        if (id != command.Id)
        {
            return BadRequest(Result<UpdateProductIncentiveResponse>.Failure("ID mismatch"));
        }

        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
        {
            return BadRequest(Result<UpdateProductIncentiveResponse>.Failure("User not authenticated."));
        }

        command.AdminId = userId;
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/v1/incentives/product/{id}
    // Roles: Admin, SuperAdmin
    // ─────────────────────────────────────────────────────────────────────────
    [HttpDelete("product/{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<bool>>> DeleteProductIncentive(Guid id)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
        {
            return BadRequest(Result<bool>.Failure("User not authenticated."));
        }

        var command = new DeleteProductIncentiveCommand
        {
            Id = id,
            AdminId = userId
        };

        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/incentives/product
    // Roles: Admin, SuperAdmin
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("product")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<List<ProductIncentiveDto>>>> GetProductIncentives(
        [FromQuery] Guid? productId,
        [FromQuery] bool? isActive)
    {
        var query = new GetProductIncentivesQuery
        {
            ProductId = productId,
            IsActive = isActive
        };

        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/incentives/salesman-summary
    // Roles: Admin, SuperAdmin, Salesman
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("salesman-summary")]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman")]
    public async Task<ActionResult<Result<SalesmanIncentiveSummaryDto>>> GetSalesmanIncentiveSummary(
        [FromQuery] Guid? salesmanId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var userId = GetCurrentUserId();
        var isAdmin = IsAdmin();
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        // Salesman can only view their own incentive
        if (userRole == "Salesman" && !isAdmin)
        {
            salesmanId = userId;
        }

        if (!salesmanId.HasValue)
        {
            return BadRequest(Result<SalesmanIncentiveSummaryDto>.Failure("Salesman ID is required."));
        }

        var query = new GetSalesmanIncentiveQuery
        {
            SalesmanId = salesmanId,
            FromDate = fromDate,
            ToDate = toDate
        };

        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }
}