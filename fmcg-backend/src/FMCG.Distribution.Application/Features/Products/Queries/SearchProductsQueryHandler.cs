using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Products.Queries;

public class SearchProductsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<SearchProductsQuery, Result<List<ProductSearchDto>>>
{
    public async Task<Result<List<ProductSearchDto>>> Handle(SearchProductsQuery request, CancellationToken cancellationToken)
    {
        var query = context.Products
            .Include(p => p.ProductGroup)
            .Include(p => p.DefaultUnit)  // ← CHANGE ProductUnit to DefaultUnit
            .Where(p => !p.IsDeleted);

        if (request.IsActive.HasValue)
        {
            query = query.Where(p => p.IsActive == request.IsActive.Value);
        }
        else
        {
            query = query.Where(p => p.IsActive);
        }

        if (request.ProductGroupId.HasValue)
        {
            query = query.Where(p => p.ProductGroupId == request.ProductGroupId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchTerm = request.SearchTerm.Trim().ToLower();
            query = query.Where(p =>
                p.NameEnglish.ToLower().Contains(searchTerm) ||
                (p.NameMalayalam != null && p.NameMalayalam.ToLower().Contains(searchTerm)));
        }

        var products = await query
            .OrderBy(p => p.NameEnglish)
            .Take(request.Limit)
            .Select(p => new ProductSearchDto
            {
                Id = p.Id,
                NameEnglish = p.NameEnglish,
                NameMalayalam = p.NameMalayalam,
                ProductGroupId = p.ProductGroupId,
                ProductGroupName = p.ProductGroup != null ? p.ProductGroup.Name : string.Empty,
                ProductUnitId = p.DefaultUnitId,  // ← CHANGE THIS
                UnitName = p.DefaultUnit != null ? p.DefaultUnit.Name : string.Empty,  // ← CHANGE THIS
                UnitSymbol = p.DefaultUnit != null ? p.DefaultUnit.Symbol : string.Empty,  // ← CHANGE THIS
                BasePrice = p.BasePrice,
                IsActive = p.IsActive
            })
            .ToListAsync(cancellationToken);

        return Result<List<ProductSearchDto>>.Success(products);
    }
}