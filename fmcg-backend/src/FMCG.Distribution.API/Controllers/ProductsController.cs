using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.BasePrices.Commands;
using FMCG.Distribution.Application.Features.BasePrices.Queries;
using FMCG.Distribution.Application.Features.Products.Commands;
using FMCG.Distribution.Application.Features.Products.DTOs;
using FMCG.Distribution.Application.Features.Products.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]  // ← Changed from specific roles to allow all authenticated users
public class ProductsController(IMediator mediator, IApplicationDbContext context) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
    }

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<CreateProductResponse>>> Create([FromBody] CreateProductCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<UpdateProductResponse>>> Update(Guid id, [FromBody] UpdateProductCommand command)
    {
        if (id != command.Id)
            return BadRequest(Result<UpdateProductResponse>.Failure("ID mismatch"));
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<bool>>> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteProductCommand { Id = id });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman,Accounts,Warehouse")]  // ← Add Salesman
    public async Task<ActionResult<Result<List<ProductDto>>>> GetAll(
        [FromQuery] Guid? productGroupId,
        [FromQuery] bool? isActive)
    {
        var result = await mediator.Send(new GetAllProductsQuery
        {
            ProductGroupId = productGroupId,
            IsActive = isActive
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman,Accounts,Warehouse")]  // ← Add Salesman
    public async Task<ActionResult<Result<ProductDetailDto>>> GetById(Guid id)
    {
        var result = await mediator.Send(new GetProductByIdQuery { Id = id });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpGet("search")]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman,Accounts,Warehouse")]  // ← Add Salesman
    public async Task<ActionResult<Result<List<ProductSearchDto>>>> Search(
        [FromQuery] string? searchTerm,
        [FromQuery] Guid? productGroupId,
        [FromQuery] bool? isActive,
        [FromQuery] int limit = 50)
    {
        var result = await mediator.Send(new SearchProductsQuery
        {
            SearchTerm = searchTerm,
            ProductGroupId = productGroupId,
            IsActive = isActive,
            Limit = limit
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPut("{id}/base-price")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<UpdateBasePriceResponse>>> UpdateBasePrice(
        Guid id,
        [FromBody] UpdateBasePriceCommand command)
    {
        if (id != command.ProductId)
            return BadRequest(Result<UpdateBasePriceResponse>.Failure("ID mismatch"));
        command.AdminId = GetCurrentUserId();
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpGet("{id}/price-history")]
    [Authorize(Roles = "Admin,SuperAdmin")]  // ← Keep admin only
    public async Task<ActionResult<Result<List<ProductPriceHistoryDto>>>> GetPriceHistory(
        Guid id,
        [FromQuery] int? limit)
    {
        var result = await mediator.Send(new GetProductPriceHistoryQuery
        {
            ProductId = id,
            Limit = limit
        });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NEW: Per-Unit Pricing Endpoints
    // ─────────────────────────────────────────────────────────────────────────

    // GET /api/v1/products/{productId}/unit-prices
    [HttpGet("{productId}/unit-prices")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<List<ProductUnitPriceDto>>>> GetProductUnitPrices(Guid productId)
    {
        var unitPrices = await context.ProductUnitPrices
            .Include(p => p.ProductUnit)
            .Where(p => p.ProductId == productId && !p.IsDeleted)
            .Select(p => new ProductUnitPriceDto
            {
                Id = p.Id,
                ProductId = p.ProductId,
                ProductUnitId = p.ProductUnitId,
                UnitName = p.ProductUnit != null ? p.ProductUnit.Name : string.Empty,
                UnitSymbol = p.ProductUnit != null ? p.ProductUnit.Symbol : string.Empty,
                UnitSize = p.UnitSize,
                UnitSizeLabel = p.UnitSizeLabel,
                SalePrice = p.SalePrice,
                SalePrice2 = p.SalePrice2,
                SalePrice3 = p.SalePrice3,
                SalePrice4 = p.SalePrice4,
                PurchaseRate = p.PurchaseRate,
                LandingCost = p.LandingCost,
                MRP = p.MRP,
                MOP = p.MOP,
                Discount1 = p.Discount1,
                Discount2 = p.Discount2,
                Discount3 = p.Discount3,
                Discount4 = p.Discount4,
                VAT = p.VAT,
                FloodCost = p.FloodCost,
                IsDefault = p.IsDefault,
                IsActive = p.IsActive
            })
            .ToListAsync();

        return Ok(Result<List<ProductUnitPriceDto>>.Success(unitPrices));
    }

    // POST /api/v1/products/unit-price
    [HttpPost("unit-price")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<ProductUnitPriceDto>>> AddProductUnitPrice(
        [FromBody] CreateProductUnitPriceDto dto)
    {
        var product = await context.Products
            .FirstOrDefaultAsync(p => p.Id == dto.ProductId && !p.IsDeleted);

        if (product == null)
            return BadRequest(Result<ProductUnitPriceDto>.Failure("Product not found."));

        var unit = await context.ProductUnits
            .FirstOrDefaultAsync(u => u.Id == dto.ProductUnitId && !u.IsDeleted);

        if (unit == null)
            return BadRequest(Result<ProductUnitPriceDto>.Failure("Unit not found."));

        var unitPrice = new FMCG.Distribution.Domain.Entities.ProductUnitPrice
        {
            Id = Guid.NewGuid(),
            ProductId = dto.ProductId,
            ProductUnitId = dto.ProductUnitId,
            UnitSize = dto.UnitSize,
            UnitSizeLabel = dto.UnitSizeLabel,
            SalePrice = dto.SalePrice,
            SalePrice2 = dto.SalePrice2,
            SalePrice3 = dto.SalePrice3,
            SalePrice4 = dto.SalePrice4,
            PurchaseRate = dto.PurchaseRate,
            LandingCost = dto.LandingCost,
            MRP = dto.MRP,
            MOP = dto.MOP,
            Discount1 = dto.Discount1,
            Discount2 = dto.Discount2,
            Discount3 = dto.Discount3,
            Discount4 = dto.Discount4,
            VAT = dto.VAT,
            FloodCost = dto.FloodCost,
            IsDefault = dto.IsDefault,
            IsActive = true
        };

        // If this is default, unset other defaults for this product
        if (dto.IsDefault)
        {
            var existingDefaults = await context.ProductUnitPrices
                .Where(p => p.ProductId == dto.ProductId && p.IsDefault && !p.IsDeleted)
                .ToListAsync();

            foreach (var existing in existingDefaults)
            {
                existing.IsDefault = false;
            }
        }

        await context.ProductUnitPrices.AddAsync(unitPrice);
        await context.SaveChangesAsync();

        var result = new ProductUnitPriceDto
        {
            Id = unitPrice.Id,
            ProductId = unitPrice.ProductId,
            ProductUnitId = unitPrice.ProductUnitId,
            UnitName = unit.Name,
            UnitSymbol = unit.Symbol,
            UnitSize = unitPrice.UnitSize,
            UnitSizeLabel = unitPrice.UnitSizeLabel,
            SalePrice = unitPrice.SalePrice,
            SalePrice2 = unitPrice.SalePrice2,
            SalePrice3 = unitPrice.SalePrice3,
            SalePrice4 = unitPrice.SalePrice4,
            PurchaseRate = unitPrice.PurchaseRate,
            LandingCost = unitPrice.LandingCost,
            MRP = unitPrice.MRP,
            MOP = unitPrice.MOP,
            Discount1 = unitPrice.Discount1,
            Discount2 = unitPrice.Discount2,
            Discount3 = unitPrice.Discount3,
            Discount4 = unitPrice.Discount4,
            VAT = unitPrice.VAT,
            FloodCost = unitPrice.FloodCost,
            IsDefault = unitPrice.IsDefault,
            IsActive = unitPrice.IsActive
        };

        return Ok(Result<ProductUnitPriceDto>.Success(result, "Unit price added successfully."));
    }

    // PUT /api/v1/products/unit-price/{id}
    [HttpPut("unit-price/{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<ProductUnitPriceDto>>> UpdateProductUnitPrice(
        Guid id,
        [FromBody] UpdateProductUnitPriceDto dto)
    {
        var unitPrice = await context.ProductUnitPrices
            .Include(p => p.ProductUnit)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (unitPrice == null)
            return NotFound(Result<ProductUnitPriceDto>.Failure("Unit price not found."));

        var unit = await context.ProductUnits
            .FirstOrDefaultAsync(u => u.Id == dto.ProductUnitId && !u.IsDeleted);

        if (unit == null)
            return BadRequest(Result<ProductUnitPriceDto>.Failure("Unit not found."));

        unitPrice.ProductUnitId = dto.ProductUnitId;
        unitPrice.UnitSize = dto.UnitSize;
        unitPrice.UnitSizeLabel = dto.UnitSizeLabel;
        unitPrice.SalePrice = dto.SalePrice;
        unitPrice.SalePrice2 = dto.SalePrice2;
        unitPrice.SalePrice3 = dto.SalePrice3;
        unitPrice.SalePrice4 = dto.SalePrice4;
        unitPrice.PurchaseRate = dto.PurchaseRate;
        unitPrice.LandingCost = dto.LandingCost;
        unitPrice.MRP = dto.MRP;
        unitPrice.MOP = dto.MOP;
        unitPrice.Discount1 = dto.Discount1;
        unitPrice.Discount2 = dto.Discount2;
        unitPrice.Discount3 = dto.Discount3;
        unitPrice.Discount4 = dto.Discount4;
        unitPrice.VAT = dto.VAT;
        unitPrice.FloodCost = dto.FloodCost;
        unitPrice.IsDefault = dto.IsDefault;
        unitPrice.IsActive = dto.IsActive;
        unitPrice.UpdateTimestamp(GetCurrentUserId().ToString());

        // If this is default, unset other defaults for this product
        if (dto.IsDefault)
        {
            var existingDefaults = await context.ProductUnitPrices
                .Where(p => p.ProductId == unitPrice.ProductId
                         && p.Id != id
                         && p.IsDefault
                         && !p.IsDeleted)
                .ToListAsync();

            foreach (var existing in existingDefaults)
            {
                existing.IsDefault = false;
            }
        }

        await context.SaveChangesAsync();

        var result = new ProductUnitPriceDto
        {
            Id = unitPrice.Id,
            ProductId = unitPrice.ProductId,
            ProductUnitId = unitPrice.ProductUnitId,
            UnitName = unit.Name,
            UnitSymbol = unit.Symbol,
            UnitSize = unitPrice.UnitSize,
            UnitSizeLabel = unitPrice.UnitSizeLabel,
            SalePrice = unitPrice.SalePrice,
            SalePrice2 = unitPrice.SalePrice2,
            SalePrice3 = unitPrice.SalePrice3,
            SalePrice4 = unitPrice.SalePrice4,
            PurchaseRate = unitPrice.PurchaseRate,
            LandingCost = unitPrice.LandingCost,
            MRP = unitPrice.MRP,
            MOP = unitPrice.MOP,
            Discount1 = unitPrice.Discount1,
            Discount2 = unitPrice.Discount2,
            Discount3 = unitPrice.Discount3,
            Discount4 = unitPrice.Discount4,
            VAT = unitPrice.VAT,
            FloodCost = unitPrice.FloodCost,
            IsDefault = unitPrice.IsDefault,
            IsActive = unitPrice.IsActive
        };

        return Ok(Result<ProductUnitPriceDto>.Success(result, "Unit price updated successfully."));
    }

    // DELETE /api/v1/products/unit-price/{id}
    [HttpDelete("unit-price/{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<bool>>> DeleteProductUnitPrice(Guid id)
    {
        var unitPrice = await context.ProductUnitPrices
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (unitPrice == null)
            return NotFound(Result<bool>.Failure("Unit price not found."));

        unitPrice.SoftDelete(GetCurrentUserId().ToString());
        await context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true, "Unit price deleted successfully."));
    }
}