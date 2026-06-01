using System.Security.Claims;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Routes.Commands;
using FMCG.Distribution.Application.Features.Routes.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]                          // ← any authenticated user; per-method narrows it
public class RoutesController(IMediator mediator) : ControllerBase
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

    // ── Read ops: all roles (with filtering for salesman) ─────────────────────

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
            ExecutionDate = executionDate,   // null → handler defaults to today
            IsAdmin = IsAdmin(),              // handler enforces today for non-admins
            IsOrderTaking = false             // Delivery mode
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

    // ── NEW: Order Taking Mode (visits all customers, no pre-submitted orders needed) ──
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
            IsOrderTaking = true   // Order Taking mode - visits all customers
        };

        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }
}