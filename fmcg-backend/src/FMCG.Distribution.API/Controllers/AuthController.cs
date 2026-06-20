// PATH: src/FMCG.Distribution.API/Controllers/AuthController.cs
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Auth.Commands;
using FMCG.Distribution.Application.Features.Auth.Queries;
using FMCG.Distribution.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController(IMediator mediator) : ControllerBase
{
    // ── Admin/Accounts Login (Email + Password) ──
    [HttpPost("login")]
    public async Task<ActionResult<Result<LoginResponse>>> Login([FromBody] LoginCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── Register (Admin creates users) ──
    [HttpPost("register")]
    public async Task<ActionResult<Result<RegisterResponse>>> Register([FromBody] RegisterCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── Refresh — silently renews the access token using the refresh token ──
    // POST /api/v1/auth/refresh
    // No [Authorize] — the access token has likely already expired by the
    // time this is called; the refresh token itself is the credential here.
    [HttpPost("refresh")]
    public async Task<ActionResult<Result<RefreshTokenResponse>>> Refresh([FromBody] RefreshTokenCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── PIN Login (Salesman, Admin, SuperAdmin) ──
    // POST /api/v1/auth/pin-login
    // No [Authorize] — this is the authentication entry point for PIN users.
    [HttpPost("pin-login")]
    public async Task<ActionResult<Result<LoginResponse>>> PinLogin([FromBody] PinLoginCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── Set/Change PIN ──
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

    // ── Check PIN availability (Instagram-style "already taken" check) ──
    // POST /api/v1/auth/check-pin-availability
    // Admin/SuperAdmin only — this still relies on BCrypt.Verify under the
    // hood (PINs are never stored in reversible form), but exposing it
    // without restriction would let anyone brute-force which 4–6 digit PINs
    // are in use, so only trusted admin callers can ask.
    [HttpPost("check-pin-availability")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<CheckPinAvailabilityResponse>>> CheckPinAvailability(
        [FromBody] CheckPinAvailabilityQuery query)
    {
        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── Logout — records the logout time for the session ──
    // POST /api/v1/auth/logout
    // No [Authorize] — deliberately. If the access token has already expired
    // by the time the user logs out (the exact scenario this exists to
    // handle), requiring a valid Bearer token here would 401 and the logout
    // time would never get recorded. The sessionId itself (an unguessable
    // random GUID) is sufficient — worst case someone marks an arbitrary
    // session as logged out early, which is low severity.
    [HttpPost("logout")]
    public async Task<ActionResult<Result<bool>>> Logout(
        [FromBody] LogoutRequest request,
        [FromServices] Infrastructure.Persistence.ApplicationDbContext context)
    {
        UserSession? session = null;

        // Prefer the exact session the frontend told us about.
        if (request.SessionId != Guid.Empty)
        {
            session = await context.UserSessions
                .FirstOrDefaultAsync(s => s.Id == request.SessionId && s.LogoutAt == null,
                    HttpContext.RequestAborted);
        }

        // Fallback: close the authenticated user's most recent still-open
        // session. This is the safety net — if the frontend ever fails to
        // pass a sessionId (e.g. an older cached build, or it just never
        // got threaded through), logout still gets recorded correctly
        // instead of silently doing nothing.
        if (session == null)
        {
            var callerIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(callerIdStr, out var callerId))
            {
                session = await context.UserSessions
                    .Where(s => s.UserId == callerId && s.LogoutAt == null)
                    .OrderByDescending(s => s.LoginAt)
                    .FirstOrDefaultAsync(HttpContext.RequestAborted);
            }
        }

        if (session != null)
        {
            session.LogoutAt = DateTime.UtcNow;
            await context.SaveChangesAsync(HttpContext.RequestAborted);
        }

        return Ok(Result<bool>.Success(true));
    }

    // ── Get session history (admin only) ──
    // GET /api/v1/auth/sessions?userId=...&limit=50
    [HttpGet("sessions")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<List<UserSessionDto>>>> GetSessions(
        [FromQuery] Guid? userId,
        [FromQuery] int limit,
        [FromServices] Infrastructure.Persistence.ApplicationDbContext context)
    {
        var query = context.UserSessions
            .Include(s => s.User)
            .Where(s => !s.IsDeleted);

        if (userId.HasValue)
            query = query.Where(s => s.UserId == userId.Value);

        var take = limit > 0 ? limit : 50;

        var sessions = await query
            .OrderByDescending(s => s.LoginAt)
            .Take(take)
            .Select(s => new UserSessionDto
            {
                SessionId = s.Id,
                UserId = s.UserId,
                FullName = s.User!.FullName,
                Role = s.User.Role.ToString(),
                LoginAt = s.LoginAt,
                LogoutAt = s.LogoutAt,
                LoginMethod = s.LoginMethod,
                DurationMinutes = s.LogoutAt.HasValue
                    ? (int)(s.LogoutAt.Value - s.LoginAt).TotalMinutes
                    : (int)(DateTime.UtcNow - s.LoginAt).TotalMinutes,
            })
            .ToListAsync(HttpContext.RequestAborted);

        return Ok(Result<List<UserSessionDto>>.Success(sessions));
    }
}

// ── DTOs for logout/session-log endpoints ──────────────────────────────────────
public class LogoutRequest
{
    public Guid SessionId { get; set; }
}

public class UserSessionDto
{
    public Guid SessionId { get; set; }
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime LoginAt { get; set; }
    public DateTime? LogoutAt { get; set; }
    public string LoginMethod { get; set; } = string.Empty;
    public int DurationMinutes { get; set; }
}