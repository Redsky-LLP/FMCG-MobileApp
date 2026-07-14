using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Features.Products.Commands;

public class CreateProductCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateProductCommand, Result<CreateProductResponse>>
{
    public async Task<Result<CreateProductResponse>> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        // ── ADD THIS DEBUG ──
        // ── DEBUG: Log the raw request properties ──
        Console.WriteLine($"🔵 RAW - UnitSize: {request.UnitSize}");
        Console.WriteLine($"🔵 RAW - Incentive: {request.Incentive}");

        Console.WriteLine("=========================================");
        Console.WriteLine($"🔵 UnitSize received: {request.UnitSize}");
        Console.WriteLine($"🔵 Incentive received: {request.Incentive}");
        Console.WriteLine($"🔵 Name: {request.NameEnglish}");
        Console.WriteLine("=========================================");
        if (string.IsNullOrWhiteSpace(request.ItemCode))
        {
            return Result<CreateProductResponse>.Failure("Item Code is required.");
        }

        var productGroup = await context.ProductGroups
            .FirstOrDefaultAsync(g => g.Id == request.ProductGroupId && !g.IsDeleted, cancellationToken);
        if (productGroup == null)
        {
            return Result<CreateProductResponse>.Failure("Product group not found.");
        }

        var unit = await context.ProductUnits
            .FirstOrDefaultAsync(u => u.Id == request.ProductUnitId && !u.IsDeleted, cancellationToken);
        if (unit == null)
        {
            return Result<CreateProductResponse>.Failure("Unit not found.");
        }

        // ── NEW: Validate SizeGroup if provided ──
        if (request.SizeGroupId.HasValue)
        {
            var sizeGroup = await context.SizeGroups
                .FirstOrDefaultAsync(sg => sg.Id == request.SizeGroupId.Value && !sg.IsDeleted, cancellationToken);
            if (sizeGroup == null)
            {
                return Result<CreateProductResponse>.Failure("Size group not found.");
            }
        }

        var product = new Product
        {
            Id = Guid.NewGuid(),
            NameEnglish = request.NameEnglish,
            NameMalayalam = request.NameMalayalam,
            ProductGroupId = request.ProductGroupId,
            DefaultUnitId = request.ProductUnitId,
            BasePrice = request.BasePrice,
            ItemCode = request.ItemCode,
            Sku = request.Sku,
            HSNCode = request.HSNCode,
            Supplier = request.Supplier,
            ClosingStock = request.ClosingStock ?? 0,
            MinOrderQty = request.MinOrderQty,
            MaxOrderQty = request.MaxOrderQty,
            UnitSize = request.UnitSize,    // ← ADD THIS
            Incentive = request.Incentive,  // ← ADD THIS
            // ── NEW: Size Group ──
            SizeGroupId = request.SizeGroupId,
            IsActive = true
        };
        Console.WriteLine($"🔵 Product.UnitSize: {product.UnitSize}");
        Console.WriteLine($"🔵 Product.Incentive: {product.Incentive}");
        await context.Products.AddAsync(product, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return Result<CreateProductResponse>.Success(new CreateProductResponse
        {
            Id = product.Id,
            NameEnglish = product.NameEnglish,
            NameMalayalam = product.NameMalayalam,
            ProductGroupId = product.ProductGroupId,
            ProductUnitId = product.DefaultUnitId,
            BasePrice = product.BasePrice,
            IsActive = product.IsActive,
            ItemCode = product.ItemCode,
            SizeGroupId = product.SizeGroupId
        }, "Product created successfully.");
    }
}