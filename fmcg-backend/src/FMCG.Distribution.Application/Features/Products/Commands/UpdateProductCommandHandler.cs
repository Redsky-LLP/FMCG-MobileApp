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

        // Verify ProductGroup exists if changed
        if (product.ProductGroupId != request.ProductGroupId)
        {
            var productGroup = await context.ProductGroups
                .FirstOrDefaultAsync(g => g.Id == request.ProductGroupId && !g.IsDeleted, cancellationToken);
            if (productGroup == null)
            {
                return Result<UpdateProductResponse>.Failure("Product group not found.");
            }
        }

        // Verify ProductUnit exists if changed - CHANGE ProductUnitId to DefaultUnitId
        if (product.DefaultUnitId != request.ProductUnitId)
        {
            var unit = await context.ProductUnits
                .FirstOrDefaultAsync(u => u.Id == request.ProductUnitId && !u.IsDeleted, cancellationToken);
            if (unit == null)
            {
                return Result<UpdateProductResponse>.Failure("Unit not found.");
            }
        }

        product.NameEnglish = request.NameEnglish;
        product.NameMalayalam = request.NameMalayalam;
        product.ProductGroupId = request.ProductGroupId;
        product.DefaultUnitId = request.ProductUnitId;  // ← CHANGE THIS
        product.BasePrice = request.BasePrice;
        product.IsActive = request.IsActive;
        product.UpdateTimestamp("system");

        await context.SaveChangesAsync(cancellationToken);

        return Result<UpdateProductResponse>.Success(new UpdateProductResponse
        {
            Id = product.Id,
            NameEnglish = product.NameEnglish,
            NameMalayalam = product.NameMalayalam,
            ProductGroupId = product.ProductGroupId,
            ProductUnitId = product.DefaultUnitId,  // ← CHANGE THIS
            BasePrice = product.BasePrice,
            IsActive = product.IsActive
        }, "Product updated successfully.");
    }
}