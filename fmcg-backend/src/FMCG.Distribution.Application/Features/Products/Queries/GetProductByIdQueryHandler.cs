using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Products.Queries;

public class GetProductByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetProductByIdQuery, Result<ProductDetailDto>>
{
    public async Task<Result<ProductDetailDto>> Handle(GetProductByIdQuery request, CancellationToken cancellationToken)
    {
        var product = await context.Products
            .Include(p => p.ProductGroup)
            .Include(p => p.DefaultUnit)  // ← CHANGE ProductUnit to DefaultUnit
            .FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);

        if (product == null)
        {
            return Result<ProductDetailDto>.Failure("Product not found.");
        }

        var dto = new ProductDetailDto
        {
            Id = product.Id,
            NameEnglish = product.NameEnglish,
            NameMalayalam = product.NameMalayalam,
            ProductGroupId = product.ProductGroupId,
            ProductGroupName = product.ProductGroup?.Name,
            ProductGroupDescription = product.ProductGroup?.Description,
            ProductUnitId = product.DefaultUnitId,  // ← CHANGE THIS
            ProductUnitName = product.DefaultUnit?.Name,  // ← CHANGE THIS
            ProductUnitSymbol = product.DefaultUnit?.Symbol,  // ← CHANGE THIS
            BasePrice = product.BasePrice,
            IsActive = product.IsActive,
            CreatedAt = product.CreatedAt
        };

        return Result<ProductDetailDto>.Success(dto);
    }
}