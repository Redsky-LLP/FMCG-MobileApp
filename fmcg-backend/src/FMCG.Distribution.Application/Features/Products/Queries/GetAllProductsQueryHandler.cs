using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Products.Queries;

public class GetAllProductsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetAllProductsQuery, Result<List<ProductDto>>>
{
    public async Task<Result<List<ProductDto>>> Handle(GetAllProductsQuery request, CancellationToken cancellationToken)
    {
        var query = context.Products
            .Include(p => p.ProductGroup)
            .Include(p => p.DefaultUnit)  // ← CHANGE ProductUnit to DefaultUnit
            .Where(p => !p.IsDeleted);

        if (request.ProductGroupId.HasValue)
        {
            query = query.Where(p => p.ProductGroupId == request.ProductGroupId.Value);
        }

        if (request.IsActive.HasValue)
        {
            query = query.Where(p => p.IsActive == request.IsActive.Value);
        }

        var products = await query
            .OrderBy(p => p.ProductGroupId)
            .ThenBy(p => p.NameEnglish)
            .Select(p => new ProductDto
            {
                Id = p.Id,
                NameEnglish = p.NameEnglish,
                NameMalayalam = p.NameMalayalam,
                ProductGroupId = p.ProductGroupId,
                ProductGroupName = p.ProductGroup != null ? p.ProductGroup.Name : null,
                ProductUnitId = p.DefaultUnitId,  // ← CHANGE THIS
                ProductUnitName = p.DefaultUnit != null ? p.DefaultUnit.Name : null,  // ← CHANGE THIS
                ProductUnitSymbol = p.DefaultUnit != null ? p.DefaultUnit.Symbol : null,  // ← CHANGE THIS
                BasePrice = p.BasePrice,
                IsActive = p.IsActive,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Result<List<ProductDto>>.Success(products);
    }
}