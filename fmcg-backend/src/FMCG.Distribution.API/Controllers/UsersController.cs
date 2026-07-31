// PATH: src/FMCG.Distribution.API/Controllers/UsersController.cs
// FIXED: Added IMediator injection

using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Users.Commands;
using FMCG.Distribution.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class UsersController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IMediator _mediator;

    // ── FIX: Inject both context AND mediator ──
    public UsersController(IApplicationDbContext context, IMediator mediator)
    {
        _context = context;
        _mediator = mediator;
    }

    // ── Create Salesman Endpoint ──
    [HttpPost("salesman")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<CreateSalesmanResponse>>> CreateSalesman(
        [FromBody] CreateSalesmanCommand command)
    {
        var result = await _mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // GET /api/v1/users?role=Salesman
    [HttpGet]
    public async Task<ActionResult<Result<List<UserDto>>>> GetUsers([FromQuery] UserRole? role)
    {
        var query = _context.Users
            .Where(u => !u.IsDeleted && u.IsActive);

        if (role.HasValue)
            query = query.Where(u => u.Role == role.Value);

        var users = await query
            .OrderBy(u => u.FullName)
            .Select(u => new UserDto
            {
                Id = u.Id,
                Email = u.Email,
                FullName = u.FullName,
                Role = u.Role.ToString(),
                IsActive = u.IsActive,
            })
            .ToListAsync();

        return Ok(Result<List<UserDto>>.Success(users));
    }

    // GET /api/v1/users/all?role=Salesman
    [HttpGet("all")]
    public async Task<ActionResult<Result<List<UserDto>>>> GetAllUsers([FromQuery] UserRole? role)
    {
        var query = _context.Users
            .Where(u => !u.IsDeleted);

        if (role.HasValue)
            query = query.Where(u => u.Role == role.Value);

        var users = await query
            .OrderBy(u => u.FullName)
            .Select(u => new UserDto
            {
                Id = u.Id,
                Email = u.Email,
                FullName = u.FullName,
                Role = u.Role.ToString(),
                IsActive = u.IsActive,
            })
            .ToListAsync();

        return Ok(Result<List<UserDto>>.Success(users));
    }

    // PATCH /api/v1/users/{id}/toggle-active
    [HttpPatch("{id}/toggle-active")]
    public async Task<ActionResult<Result<bool>>> ToggleActive(Guid id)
    {
        var callerRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);

        if (user == null)
            return NotFound(Result<bool>.Failure("User not found."));

        // Prevent Admin from toggling SuperAdmin or other Admin accounts.
        if (callerRole == "Admin" &&
            (user.Role == UserRole.SuperAdmin || user.Role == UserRole.Admin))
        {
            return BadRequest(Result<bool>.Failure(
                "Admin cannot deactivate Admin or SuperAdmin accounts. Contact a SuperAdmin."));
        }

        user.IsActive = !user.IsActive;
        await _context.SaveChangesAsync();

        var msg = user.IsActive ? "User activated successfully." : "User deactivated successfully.";
        return Ok(Result<bool>.Success(true, msg));
    }

    // DELETE /api/v1/users/{id}
    // Permanently removes the user row (and its sessions) from the database.
    // Only allowed on accounts that are already deactivated — deactivate first
    // if this is still active. This is what actually frees the username/PIN
    // for reuse; Deactivate alone does not (it only flips IsActive).
    [HttpDelete("{id}")]
    public async Task<ActionResult<Result<bool>>> DeleteUser(Guid id)
    {
        var callerRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        var callerId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);

        if (user == null)
            return NotFound(Result<bool>.Failure("User not found."));

        if (callerId != null && Guid.TryParse(callerId, out var callerGuid) && callerGuid == id)
            return BadRequest(Result<bool>.Failure("You cannot delete your own account."));

        // Same protection as ToggleActive — Admin cannot remove Admin/SuperAdmin.
        if (callerRole == "Admin" &&
            (user.Role == UserRole.SuperAdmin || user.Role == UserRole.Admin))
        {
            return BadRequest(Result<bool>.Failure(
                "Admin cannot delete Admin or SuperAdmin accounts. Contact a SuperAdmin."));
        }

        if (user.IsActive)
        {
            return BadRequest(Result<bool>.Failure(
                "Deactivate this user first before permanently deleting them."));
        }

        // Refuse to hard-delete anyone with real order history — deleting the
        // row would either fail on the RouteExecutions FK or silently orphan
        // past orders. Keep them deactivated instead; that already hides them
        // everywhere that matters.
        var hasHistory = await _context.RouteExecutions
            .AnyAsync(e => e.SalesmanId == id);

        if (hasHistory)
        {
            return BadRequest(Result<bool>.Failure(
                "This user has order/route history and can't be permanently deleted. " +
                "It will remain deactivated (hidden from active use, but preserved for records)."));
        }

        var sessions = _context.UserSessions.Where(s => s.UserId == id);
        _context.UserSessions.RemoveRange(sessions);

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true, $"{user.FullName} has been permanently deleted."));
    }
}

// ── DTO ───────────────────────────────────────────────────────────────────────
public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}