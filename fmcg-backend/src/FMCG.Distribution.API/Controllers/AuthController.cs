using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Auth.Commands;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController(IMediator mediator) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<Result<LoginResponse>>> Login([FromBody] LoginCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPost("register")]
    public async Task<ActionResult<Result<RegisterResponse>>> Register([FromBody] RegisterCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── PIN Login ─────────────────────────────────────────────────────────────
    // POST /api/v1/auth/pin-login
    // No [Authorize] — this is the authentication entry point.
    [HttpPost("pin-login")]
    public async Task<ActionResult<Result<LoginResponse>>> PinLogin([FromBody] PinLoginCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // POST /api/v1/auth/set-pin
    // Authenticated — user sets their own PIN after initial password login.
    // Admin may call on behalf of a salesman by passing userId in body;
    // the controller enforces that a non-admin can only set their own PIN.
    [HttpPost("set-pin")]
    [Authorize]
    public async Task<ActionResult<Result<bool>>> SetPin([FromBody] SetPinCommand command)
    {
        var callerIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var callerRole = User.FindFirst(ClaimTypes.Role)?.Value;

        if (!Guid.TryParse(callerIdStr, out var callerId))
            return BadRequest(Result<bool>.Failure("User not authenticated."));

        var isAdmin = callerRole == "Admin" || callerRole == "SuperAdmin";

        // Non-admin can only set their own PIN
        if (!isAdmin)
            command.UserId = callerId;

        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }
    // ─────────────────────────────────────────────────────────────────────────
}