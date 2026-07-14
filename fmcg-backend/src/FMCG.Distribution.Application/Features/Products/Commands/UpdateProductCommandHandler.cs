using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Products.Commands;

public class UpdateProductCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateProductCommand, Result<UpdateProductResponse>>
{
    public async Task<Result<UpdateProductResponse>> Handle(UpdateProductCommand request, CancellationToken cancellationToken)
    {
        var product = await context.Products
            .FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);

        if (product == null)
        {
            return Result<UpdateProductResponse>.Failure("Product not found.");
        }

        if (string.IsNullOrWhiteSpace(request.ItemCode))
        {
            return Result<UpdateProductResponse>.Failure("Item Code is required.");
        }

        if (product.ProductGroupId != request.ProductGroupId)
        {
            var productGroup = await context.ProductGroups
                .FirstOrDefaultAsync(g => g.Id == request.ProductGroupId && !g.IsDeleted, cancellationToken);
            if (productGroup == null)
            {
                return Result<UpdateProductResponse>.Failure("Product group not found.");
            }
        }

        if (product.DefaultUnitId != request.ProductUnitId)
        {
            var unit = await context.ProductUnits
                .FirstOrDefaultAsync(u => u.Id == request.ProductUnitId && !u.IsDeleted, cancellationToken);
            if (unit == null)
            {
                return Result<UpdateProductResponse>.Failure("Unit not found.");
            }
        }

        // ── NEW: Validate SizeGroup if changed ──
        if (product.SizeGroupId != request.SizeGroupId && request.SizeGroupId.HasValue)
        {
            var sizeGroup = await context.SizeGroups
                .FirstOrDefaultAsync(sg => sg.Id == request.SizeGroupId.Value && !sg.IsDeleted, cancellationToken);
            if (sizeGroup == null)
            {
                return Result<UpdateProductResponse>.Failure("Size group not found.");
            }
        }

        product.NameEnglish = request.NameEnglish;
        product.NameMalayalam = request.NameMalayalam;
        product.ProductGroupId = request.ProductGroupId;
        product.DefaultUnitId = request.ProductUnitId;
        product.BasePrice = request.BasePrice;
        product.IsActive = request.IsActive;
        product.ItemCode = request.ItemCode;
        product.Sku = request.Sku;
        product.HSNCode = request.HSNCode;
        product.Supplier = request.Supplier;
        if (request.ClosingStock.HasValue) product.ClosingStock = request.ClosingStock.Value;
        product.MinOrderQty = request.MinOrderQty;
        product.MaxOrderQty = request.MaxOrderQty;
        product.UnitSize = request.UnitSize;    // ← ADD THIS
        product.Incentive = request.Incentive;  // ← ADD THIS
        // ── NEW: Size Group ──
        product.SizeGroupId = request.SizeGroupId;
        product.UpdateTimestamp("system");

        await context.SaveChangesAsync(cancellationToken);

        return Result<UpdateProductResponse>.Success(new UpdateProductResponse
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
        }, "Product updated successfully.");
    }
}