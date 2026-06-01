// PATH: src/FMCG.Distribution.API/Controllers/UsersController.cs
// MODIFIED — added GET /all (includes inactive) and PATCH /{id}/toggle-active

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class UsersController(IApplicationDbContext context) : ControllerBase
{
    // GET /api/v1/users?role=Salesman
    // Returns active users only. Used for dropdowns (e.g. route salesman assignment).
    [HttpGet]
    public async Task<ActionResult<Result<List<UserDto>>>> GetUsers([FromQuery] UserRole? role)
    {
        var query = context.Users
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
    // Returns ALL users including inactive. Used for the Admin Users management page.
    [HttpGet("all")]
    public async Task<ActionResult<Result<List<UserDto>>>> GetAllUsers([FromQuery] UserRole? role)
    {
        var query = context.Users
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
    // Flips IsActive. Admin can deactivate resigned salesmen immediately.
    // SuperAdmin can deactivate/reactivate any role.
    [HttpPatch("{id}/toggle-active")]
    public async Task<ActionResult<Result<bool>>> ToggleActive(Guid id)
    {
        var callerRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);

        if (user == null)
            return NotFound(Result<bool>.Failure("User not found."));

        // Prevent Admin from toggling SuperAdmin or other Admin accounts.
        // Only SuperAdmin can manage Admin-level accounts.
        if (callerRole == "Admin" &&
            (user.Role == UserRole.SuperAdmin || user.Role == UserRole.Admin))
        {
            return BadRequest(Result<bool>.Failure(
                "Admin cannot deactivate Admin or SuperAdmin accounts. Contact a SuperAdmin."));
        }

        user.IsActive = !user.IsActive;
        await context.SaveChangesAsync();

        var msg = user.IsActive ? "User activated successfully." : "User deactivated successfully.";
        return Ok(Result<bool>.Success(true, msg));
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