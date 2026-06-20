using System.Security.Claims;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Routes.Commands;
using FMCG.Distribution.Application.Features.Routes.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class RoutesController(IMediator mediator, IApplicationDbContext context) : ControllerBase
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

    private string GetCurrentUserRole()
    {
        return User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
    }

    // ── Admin-only write ops ─────────────────────────────────────────────────

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<CreateRouteResponse>>> Create([FromBody] CreateRouteCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<UpdateRouteResponse>>> Update(Guid id, [FromBody] UpdateRouteCommand command)
    {
        if (id != command.Id)
            return BadRequest(Result<UpdateRouteResponse>.Failure("ID mismatch"));
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<bool>>> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteRouteCommand { Id = id });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── Read ops: all roles ─────────────────────────────────────────────────

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman,Accounts,Warehouse")]
    public async Task<ActionResult<Result<List<RouteDto>>>> GetAll()
    {
        var userId = GetCurrentUserId();
        var userRole = GetCurrentUserRole();
        var isAdmin = IsAdmin();

        var query = new GetAllRoutesQuery
        {
            CurrentUserId = userId,
            IsAdmin = isAdmin,
            UserRole = userRole
        };

        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman,Accounts,Warehouse")]
    public async Task<ActionResult<Result<RouteDetailDto>>> GetById(Guid id)
    {
        var userId = GetCurrentUserId();
        var isAdmin = IsAdmin();

        var query = new GetRouteByIdQuery
        {
            Id = id,
            CurrentUserId = userId,
            IsAdmin = isAdmin
        };

        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── Salesman route execution ops ─────────────────────────────────────────

    [HttpPost("{routeId}/start-execution")]
    [Authorize(Roles = "Salesman,Admin,SuperAdmin")]
    public async Task<ActionResult<Result<StartRouteExecutionResponse>>> StartRouteExecution(
        Guid routeId,
        [FromQuery] DateTime? executionDate = null)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return BadRequest(Result<StartRouteExecutionResponse>.Failure("User not authenticated."));

        var command = new StartRouteExecutionCommand
        {
            RouteId = routeId,
            SalesmanId = userId,
            ExecutionDate = executionDate,
            IsAdmin = IsAdmin(),
            IsOrderTaking = false
        };

        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpGet("{routeId}/current-execution")]
    [Authorize(Roles = "Salesman,Admin,SuperAdmin")]
    public async Task<ActionResult<Result<CurrentRouteExecutionDto>>> GetCurrentRouteExecution(Guid routeId)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return BadRequest(Result<CurrentRouteExecutionDto>.Failure("User not authenticated."));

        var query = new GetCurrentRouteExecutionQuery
        {
            RouteId = routeId,
            SalesmanId = userId
        };

        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPost("record-visit")]
    [Authorize(Roles = "Salesman")]
    public async Task<ActionResult<Result<RecordCustomerVisitResponse>>> RecordCustomerVisit(
        [FromBody] RecordCustomerVisitCommand command)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return BadRequest(Result<RecordCustomerVisitResponse>.Failure("User not authenticated."));

        command.SalesmanId = userId;
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPost("{executionId}/complete-execution")]
    [Authorize(Roles = "Salesman")]
    public async Task<ActionResult<Result<CompleteRouteExecutionResponse>>> CompleteRouteExecution(Guid executionId)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return BadRequest(Result<CompleteRouteExecutionResponse>.Failure("User not authenticated."));

        var command = new CompleteRouteExecutionCommand
        {
            ExecutionId = executionId,
            SalesmanId = userId
        };

        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── Close Day (Admin only) — closes EVERY open route execution at once ──
    // POST /api/v1/routes/close-day
    // This is what makes routes fresh again for the next day. Not the same
    // as completeRouteExecution above (which is per-route, salesman-facing,
    // and requires all stops visited) — this is a hard admin cutoff.
    [HttpPost("close-day")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<CloseDayResponse>>> CloseDay()
    {
        var userId = GetCurrentUserId();
        var command = new CloseDayCommand { AdminUserId = userId };
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── NEW: Order Taking Mode ──────────────────────────────────────────────
    [HttpPost("{routeId}/start-order-taking")]
    [Authorize(Roles = "Salesman,Admin,SuperAdmin")]
    public async Task<ActionResult<Result<StartRouteExecutionResponse>>> StartOrderTaking(
        Guid routeId,
        [FromQuery] DateTime? executionDate = null)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return BadRequest(Result<StartRouteExecutionResponse>.Failure("User not authenticated."));

        var command = new StartRouteExecutionCommand
        {
            RouteId = routeId,
            SalesmanId = userId,
            ExecutionDate = executionDate,
            IsAdmin = IsAdmin(),
            IsOrderTaking = true
        };

        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── NEW: Reset CustomerVisit when order is cancelled ────────────────────
    [HttpPost("reset-visit")]
    [Authorize(Roles = "Salesman")]
    public async Task<ActionResult<Result<bool>>> ResetVisit([FromBody] ResetVisitRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
            return BadRequest(Result<bool>.Failure("User not authenticated."));

        var visit = await context.CustomerVisits
            .FirstOrDefaultAsync(v => v.Id == request.VisitId && !v.IsDeleted);

        if (visit == null)
        {
            return NotFound(Result<bool>.Failure("Visit not found."));
        }

        // Verify salesman owns this visit
        var execution = await context.RouteExecutions
            .FirstOrDefaultAsync(e => e.Id == visit.RouteExecutionId && !e.IsDeleted);

        if (execution == null || execution.SalesmanId != userId)
        {
            return Unauthorized(Result<bool>.Failure("You are not authorized to reset this visit."));
        }

        // Reset the visit
        visit.Status = VisitStatus.Pending;
        visit.OrderId = null;
        visit.VisitedAt = null;
        visit.UpdatedAt = DateTime.UtcNow;
        visit.UpdatedBy = userId.ToString();

        await context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true, "Visit reset successfully. You can now take a new order for this customer."));
    }

    // ── All active routes, visible to every salesman (no admin assignment step required) ──
    [HttpGet("active")]
    [Authorize(Roles = "Salesman")]
    public async Task<ActionResult<Result<List<ActiveRouteDto>>>> GetActiveRoutes()
    {
        var userId = GetCurrentUserId();
        var query = new GetActiveRoutesQuery { SalesmanId = userId };
        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // NOTE: the old "/start" endpoint (StartRouteCommand) was removed for good reason —
    // it had no order-taking/delivery distinction and no day-closed gating. Starting a
    // route now always goes through "/start-order-taking" or "/start-execution" above,
    // which were fixed to support the open (unassigned) route model — see
    // StartRouteExecutionCommandHandler for the locking logic.
}

// ── DTO for reset visit ──────────────────────────────────────────────────────
public class ResetVisitRequest
{
    public Guid VisitId { get; set; }
}