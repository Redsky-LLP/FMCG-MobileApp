// PATH: src/FMCG.Distribution.API/Controllers/RouteAssignmentsController.cs
// NEW FILE — daily route assignment management

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/route-assignments")]
[Authorize]
public class RouteAssignmentsController(IApplicationDbContext context) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : Guid.Empty;

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/route-assignments?date=2026-05-19
    // Admin: view all assignments for a date (or date range for week view)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<List<RouteAssignmentDto>>>> GetAssignments(
        [FromQuery] DateTime? date,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var from = (fromDate ?? date ?? DateTime.UtcNow.Date).Date;
        var to = (toDate ?? from).Date;

        var assignments = await context.RouteAssignments
            .Include(a => a.Route)
            .Include(a => a.Salesman)
            .Where(a =>
                !a.IsDeleted &&
                a.AssignmentDate.Date >= from &&
                a.AssignmentDate.Date <= to)
            .OrderBy(a => a.AssignmentDate)
            .ThenBy(a => a.Route!.SequenceOrder)
            .Select(a => new RouteAssignmentDto
            {
                Id = a.Id,
                RouteId = a.RouteId,
                RouteName = a.Route != null ? a.Route.Name : "—",
                SalesmanId = a.SalesmanId,
                SalesmanName = a.Salesman != null ? a.Salesman.FullName : "—",
                AssignmentDate = a.AssignmentDate,
                Notes = a.Notes,
            })
            .ToListAsync();

        // Enrich with routes that have NO assignment for these dates (show all routes)
        var allRoutes = await context.Routes
            .Where(r => !r.IsDeleted && r.IsActive)
            .Select(r => new { r.Id, r.Name, r.AssignedSalesmanId, r.SequenceOrder })
            .OrderBy(r => r.SequenceOrder)
            .ToListAsync();

        // For each route with no override, add the permanent assignment as a placeholder
        var assignedRouteIds = assignments.Select(a => a.RouteId).ToHashSet();
        foreach (var route in allRoutes)
        {
            if (assignedRouteIds.Contains(route.Id)) continue;

            // No override — add permanent assignment info
            if (route.AssignedSalesmanId.HasValue)
            {
                var salesman = await context.Users
                    .Where(u => u.Id == route.AssignedSalesmanId.Value)
                    .Select(u => u.FullName)
                    .FirstOrDefaultAsync();

                assignments.Add(new RouteAssignmentDto
                {
                    Id = Guid.Empty,   // sentinel: no daily override exists
                    RouteId = route.Id,
                    RouteName = route.Name,
                    SalesmanId = route.AssignedSalesmanId.Value,
                    SalesmanName = salesman ?? "—",
                    AssignmentDate = from,
                    IsPermanent = true,
                    Notes = "Permanent assignment (no daily override)",
                });
            }
        }

        return Ok(Result<List<RouteAssignmentDto>>.Success(
            assignments.OrderBy(a => a.RouteName).ToList()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/route-assignments
    // Create or update a daily assignment (upsert by RouteId + Date)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<RouteAssignmentDto>>> CreateOrUpdate(
        [FromBody] UpsertRouteAssignmentRequest request)
    {
        var date = request.AssignmentDate.Date;

        // Upsert: update if exists for this route+date, else create
        var existing = await context.RouteAssignments
            .FirstOrDefaultAsync(a =>
                a.RouteId == request.RouteId &&
                a.AssignmentDate.Date == date &&
                !a.IsDeleted);

        if (existing != null)
        {
            existing.SalesmanId = request.SalesmanId;
            existing.Notes = request.Notes;
            await context.SaveChangesAsync();
        }
        else
        {
            var newAssignment = new RouteAssignment
            {
                Id = Guid.NewGuid(),
                RouteId = request.RouteId,
                SalesmanId = request.SalesmanId,
                AssignmentDate = date,
                Notes = request.Notes,
                IsOverride = true,
            };
            await context.RouteAssignments.AddAsync(newAssignment);
            await context.SaveChangesAsync();
            existing = newAssignment;
        }

        var salesman = await context.Users
            .Where(u => u.Id == existing.SalesmanId)
            .Select(u => u.FullName).FirstOrDefaultAsync();
        var route = await context.Routes
            .Where(r => r.Id == existing.RouteId)
            .Select(r => r.Name).FirstOrDefaultAsync();

        return Ok(Result<RouteAssignmentDto>.Success(new RouteAssignmentDto
        {
            Id = existing.Id,
            RouteId = existing.RouteId,
            RouteName = route ?? "—",
            SalesmanId = existing.SalesmanId,
            SalesmanName = salesman ?? "—",
            AssignmentDate = existing.AssignmentDate,
            Notes = existing.Notes,
        }, "Assignment saved."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/v1/route-assignments/{id}
    // Remove a daily override (reverts to permanent assignment)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<bool>>> Delete(Guid id)
    {
        var assignment = await context.RouteAssignments
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

        if (assignment == null)
            return NotFound(Result<bool>.Failure("Assignment not found."));

        assignment.IsDeleted = true;
        await context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true, "Daily override removed. Permanent assignment restored."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/route-assignments/my-routes
    // Salesman: get today's assigned routes (override first, then permanent fallback)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("my-routes")]
    [Authorize(Roles = "Salesman")]
    public async Task<ActionResult<Result<List<TodayRouteDto>>>> GetMyRoutesToday(
        [FromQuery] DateTime? date)
    {
        var today = (date ?? DateTime.UtcNow).Date;
        var myId = CurrentUserId;

        // Daily overrides for today assigned to me
        var overrides = await context.RouteAssignments
            .Include(a => a.Route)
            .Where(a =>
                !a.IsDeleted &&
                a.SalesmanId == myId &&
                a.AssignmentDate.Date == today)
            .ToListAsync();

        // Permanent routes assigned to me (as fallback for dates with no override)
        var permanentRoutes = await context.Routes
            .Where(r => !r.IsDeleted && r.IsActive && r.AssignedSalesmanId == myId)
            .ToListAsync();

        var result = new List<TodayRouteDto> { };

        // Add daily overrides first
        foreach (var o in overrides)
        {
            result.Add(new TodayRouteDto
            {
                RouteId = o.RouteId,
                RouteName = o.Route?.Name ?? "—",
                IsOverride = true,
                Notes = o.Notes,
            });
        }

        // Add permanent routes that don't have a daily override today
        var overrideRouteIds = overrides.Select(o => o.RouteId).ToHashSet();
        foreach (var r in permanentRoutes)
        {
            if (!overrideRouteIds.Contains(r.Id))
            {
                result.Add(new TodayRouteDto
                {
                    RouteId = r.Id,
                    RouteName = r.Name,
                    IsOverride = false,
                    Notes = null,
                });
            }
        }

        return Ok(Result<List<TodayRouteDto>>.Success(result));
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────
public class RouteAssignmentDto
{
    public Guid Id { get; set; }
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = "";
    public Guid SalesmanId { get; set; }
    public string SalesmanName { get; set; } = "";
    public DateTime AssignmentDate { get; set; }
    public string? Notes { get; set; }
    public bool IsPermanent { get; set; } = false; // true = no daily override, showing permanent
}

public class TodayRouteDto
{
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = "";
    public bool IsOverride { get; set; }
    public string? Notes { get; set; }
}

public class UpsertRouteAssignmentRequest
{
    public Guid RouteId { get; set; }
    public Guid SalesmanId { get; set; }
    public DateTime AssignmentDate { get; set; }
    public string? Notes { get; set; }
}