// PATH: src/FMCG.Distribution.API/Controllers/ProductUnitsController.cs
// UPDATED: With null checks for enhanced unit fields

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.ProductUnits.Commands;
using FMCG.Distribution.Application.Features.ProductUnits.Queries;
using System.Security.Claims;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class ProductUnitsController(IMediator mediator, IApplicationDbContext context) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
    }

    [HttpGet]
    public async Task<ActionResult<Result<List<ProductUnitDto>>>> GetAll()
    {
        var result = await mediator.Send(new GetAllProductUnitsQuery());
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPost]
    public async Task<ActionResult<Result<CreateProductUnitResponse>>> Create(
        [FromBody] CreateProductUnitCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Result<UpdateProductUnitResponse>>> Update(
        Guid id, [FromBody] UpdateProductUnitCommand command)
    {
        if (id != command.Id)
            return BadRequest(Result<UpdateProductUnitResponse>.Failure("ID mismatch"));
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<Result<bool>>> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteProductUnitCommand { Id = id });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // Get unit priorities for loading sheet
    [HttpGet("priorities")]
    public async Task<ActionResult<Result<List<UnitPriorityDto>>>> GetUnitPriorities()
    {
        var units = await context.ProductUnits
            .Where(u => !u.IsDeleted)
            .OrderBy(u => u.LoadingPriority)
            .ThenBy(u => u.Name)
            .Select(u => new UnitPriorityDto
            {
                Id = u.Id,
                Name = u.Name,
                Symbol = u.Symbol,
                LoadingPriority = u.LoadingPriority
            })
            .ToListAsync();

        return Ok(Result<List<UnitPriorityDto>>.Success(units));
    }

    // Update loading priority for a unit
    [HttpPut("{id}/priority")]
    public async Task<ActionResult<Result<bool>>> UpdateLoadingPriority(
        Guid id,
        [FromBody] UpdatePriorityRequest request)
    {
        var unit = await context.ProductUnits
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);

        if (unit == null)
            return NotFound(Result<bool>.Failure("Unit not found."));

        unit.LoadingPriority = request.Priority;
        unit.UpdateTimestamp(GetCurrentUserId().ToString());

        await context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true, $"Loading priority updated to {request.Priority}."));
    }

    // Get enhanced units with measurement type and base values
    [HttpGet("enhanced")]
    public async Task<ActionResult<Result<List<EnhancedProductUnitDto>>>> GetEnhancedUnits()
    {
        var units = await context.ProductUnits
            .Where(u => !u.IsDeleted)
            .OrderBy(u => u.Name)
            .Select(u => new EnhancedProductUnitDto
            {
                Id = u.Id,
                Name = u.Name,
                Abbreviation = u.Abbreviation ?? u.Symbol,
                MeasurementType = u.MeasurementType,
                BaseUnitValue = u.BaseUnitValue,
                BaseUnitName = u.BaseUnitName,
                LoadingPriority = u.LoadingPriority
            })
            .ToListAsync();

        return Ok(Result<List<EnhancedProductUnitDto>>.Success(units));
    }

    // Update enhanced unit fields
    [HttpPut("{id}/enhanced")]
    public async Task<ActionResult<Result<bool>>> UpdateEnhancedUnit(
        Guid id,
        [FromBody] UpdateEnhancedUnitRequest request)
    {
        var unit = await context.ProductUnits
            .FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted);

        if (unit == null)
            return NotFound(Result<bool>.Failure("Unit not found."));

        if (!string.IsNullOrEmpty(request.MeasurementType))
            unit.MeasurementType = request.MeasurementType;

        if (request.BaseUnitValue.HasValue)
            unit.BaseUnitValue = request.BaseUnitValue;

        if (!string.IsNullOrEmpty(request.BaseUnitName))
            unit.BaseUnitName = request.BaseUnitName;

        unit.UpdateTimestamp(GetCurrentUserId().ToString());
        await context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true, "Unit updated successfully."));
    }
}

// DTOs
public class UnitPriorityDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Symbol { get; set; }
    public int LoadingPriority { get; set; }
}

public class UpdatePriorityRequest
{
    public int Priority { get; set; }
}

// Enhanced Unit DTOs
public class EnhancedProductUnitDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Abbreviation { get; set; }
    public string? MeasurementType { get; set; }  // "weight", "volume", "count"
    public decimal? BaseUnitValue { get; set; }   // e.g., 50 for "50kg"
    public string? BaseUnitName { get; set; }     // e.g., "kg" for weight
    public int LoadingPriority { get; set; }
}

public class UpdateEnhancedUnitRequest
{
    public string? MeasurementType { get; set; }
    public decimal? BaseUnitValue { get; set; }
    public string? BaseUnitName { get; set; }
}