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
        // Verify ProductGroup exists
        var productGroup = await context.ProductGroups
            .FirstOrDefaultAsync(g => g.Id == request.ProductGroupId && !g.IsDeleted, cancellationToken);
        if (productGroup == null)
        {
            return Result<CreateProductResponse>.Failure("Product group not found.");
        }

        // Verify ProductUnit exists - CHANGE ProductUnitId to DefaultUnitId
        var unit = await context.ProductUnits
            .FirstOrDefaultAsync(u => u.Id == request.ProductUnitId && !u.IsDeleted, cancellationToken);
        if (unit == null)
        {
            return Result<CreateProductResponse>.Failure("Unit not found.");
        }

        var product = new Product
        {
            Id = Guid.NewGuid(),
            NameEnglish = request.NameEnglish,
            NameMalayalam = request.NameMalayalam,
            ProductGroupId = request.ProductGroupId,
            DefaultUnitId = request.ProductUnitId,  // ← CHANGE THIS
            BasePrice = request.BasePrice,
            IsActive = true
        };

        await context.Products.AddAsync(product, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return Result<CreateProductResponse>.Success(new CreateProductResponse
        {
            Id = product.Id,
            NameEnglish = product.NameEnglish,
            NameMalayalam = product.NameMalayalam,
            ProductGroupId = product.ProductGroupId,
            ProductUnitId = product.DefaultUnitId,  // ← CHANGE THIS (mapping to response)
            BasePrice = product.BasePrice,
            IsActive = product.IsActive
        }, "Product created successfully.");
    }
}