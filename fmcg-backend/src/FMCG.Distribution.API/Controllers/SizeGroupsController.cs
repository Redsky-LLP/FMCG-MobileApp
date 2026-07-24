using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class SizeGroupsController(IApplicationDbContext context) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
    }

    // GET /api/v1/sizegroups
    // ── Now ordered by SortOrder (the client-controlled report display order) first,
    // falling back to Name for any groups that haven't been assigned one yet. ──
    [HttpGet]
    public async Task<ActionResult<Result<List<SizeGroupDto>>>> GetAll()
    {
        var groups = await context.SizeGroups
            .Where(g => !g.IsDeleted && g.IsActive)
            .OrderBy(g => g.SortOrder == -1 ? int.MaxValue : g.SortOrder)
            .ThenBy(g => g.Name)
            .Select(g => new SizeGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                NameMl = g.NameMl,
                Description = g.Description,
                IsActive = g.IsActive,
                SortOrder = g.SortOrder,
                ProductCount = context.Products.Count(p => p.SizeGroupId == g.Id && !p.IsDeleted)
            })
            .ToListAsync();

        return Ok(Result<List<SizeGroupDto>>.Success(groups));
    }

    // GET /api/v1/sizegroups/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Result<SizeGroupDto>>> GetById(Guid id)
    {
        var group = await context.SizeGroups
            .Where(g => g.Id == id && !g.IsDeleted)
            .Select(g => new SizeGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                NameMl = g.NameMl,
                Description = g.Description,
                IsActive = g.IsActive,
                SortOrder = g.SortOrder,
                ProductCount = context.Products.Count(p => p.SizeGroupId == g.Id && !p.IsDeleted)
            })
            .FirstOrDefaultAsync();

        if (group == null)
            return NotFound(Result<SizeGroupDto>.Failure("Size group not found."));

        return Ok(Result<SizeGroupDto>.Success(group));
    }

    // POST /api/v1/sizegroups
    [HttpPost]
    public async Task<ActionResult<Result<SizeGroupDto>>> Create([FromBody] CreateSizeGroupRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(Result<SizeGroupDto>.Failure("Name is required."));

        // ── New groups default to the end of the report display order (max existing
        // SortOrder + 1), rather than being left unassigned — an admin can then drag
        // it into position from the Size Groups screen if it needs to sit elsewhere. ──
        var maxSortOrder = await context.SizeGroups
            .Where(g => !g.IsDeleted && g.SortOrder != -1)
            .Select(g => (int?)g.SortOrder)
            .MaxAsync() ?? 0;

        var group = new SizeGroup
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            NameMl = request.NameMl?.Trim(),
            Description = request.Description?.Trim(),
            IsActive = true,
            SortOrder = maxSortOrder + 1
        };

        await context.SizeGroups.AddAsync(group);
        await context.SaveChangesAsync();

        return Ok(Result<SizeGroupDto>.Success(new SizeGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            NameMl = group.NameMl,
            Description = group.Description,
            IsActive = group.IsActive,
            SortOrder = group.SortOrder,
            ProductCount = 0
        }, "Size group created successfully."));
    }

    // PUT /api/v1/sizegroups/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<Result<SizeGroupDto>>> Update(Guid id, [FromBody] UpdateSizeGroupRequest request)
    {
        var group = await context.SizeGroups
            .FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);

        if (group == null)
            return NotFound(Result<SizeGroupDto>.Failure("Size group not found."));

        if (!string.IsNullOrWhiteSpace(request.Name))
            group.Name = request.Name.Trim();

        group.NameMl = request.NameMl?.Trim();
        group.Description = request.Description?.Trim();
        group.IsActive = request.IsActive;
        group.UpdateTimestamp(GetCurrentUserId().ToString());

        await context.SaveChangesAsync();

        var productCount = await context.Products
            .CountAsync(p => p.SizeGroupId == group.Id && !p.IsDeleted);

        return Ok(Result<SizeGroupDto>.Success(new SizeGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            NameMl = group.NameMl,
            Description = group.Description,
            IsActive = group.IsActive,
            SortOrder = group.SortOrder,
            ProductCount = productCount
        }, "Size group updated successfully."));
    }

    // ── NEW: PUT /api/v1/sizegroups/{id}/priority — updates report display order.
    // Mirrors ProductUnitsController's UpdateLoadingPriority endpoint/pattern exactly,
    // so the codebase handles both "priority" concepts the same way. The admin UI uses
    // this to swap two groups' SortOrder values when an up/down arrow is clicked. ──
    [HttpPut("{id}/priority")]
    public async Task<ActionResult<Result<bool>>> UpdatePriority(
        Guid id,
        [FromBody] UpdateSizeGroupPriorityRequest request)
    {
        var group = await context.SizeGroups
            .FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);

        if (group == null)
            return NotFound(Result<bool>.Failure("Size group not found."));

        group.SortOrder = request.Priority;
        group.UpdateTimestamp(GetCurrentUserId().ToString());

        await context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true, $"Display order updated to {request.Priority}."));
    }

    // DELETE /api/v1/sizegroups/{id}
    [HttpDelete("{id}")]
    public async Task<ActionResult<Result<bool>>> Delete(Guid id)
    {
        var group = await context.SizeGroups
            .FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);

        if (group == null)
            return NotFound(Result<bool>.Failure("Size group not found."));

        // Check if any products use this size group
        var hasProducts = await context.Products
            .AnyAsync(p => p.SizeGroupId == id && !p.IsDeleted);

        if (hasProducts)
            return BadRequest(Result<bool>.Failure("Cannot delete size group with associated products. Deactivate instead."));

        group.SoftDelete(GetCurrentUserId().ToString());
        await context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true, "Size group deleted successfully."));
    }
}

// ── DTOs ──
public class SizeGroupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? NameMl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; } = -1;   // NEW — report display order; -1 = not yet assigned
    public int ProductCount { get; set; }
}

public class CreateSizeGroupRequest
{
    public string Name { get; set; } = string.Empty;
    public string? NameMl { get; set; }
    public string? Description { get; set; }
}

public class UpdateSizeGroupRequest
{
    public string? Name { get; set; }
    public string? NameMl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

// ── NEW ──
public class UpdateSizeGroupPriorityRequest
{
    public int Priority { get; set; }
}