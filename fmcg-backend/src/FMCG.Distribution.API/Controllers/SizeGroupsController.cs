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
    [HttpGet]
    public async Task<ActionResult<Result<List<SizeGroupDto>>>> GetAll()
    {
        var groups = await context.SizeGroups
            .Where(g => !g.IsDeleted && g.IsActive)
            .OrderBy(g => g.Name)
            .Select(g => new SizeGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                NameMl = g.NameMl,
                Description = g.Description,
                IsActive = g.IsActive,
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

        var group = new SizeGroup
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            NameMl = request.NameMl?.Trim(),
            Description = request.Description?.Trim(),
            IsActive = true
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
            ProductCount = productCount
        }, "Size group updated successfully."));
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