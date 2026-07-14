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
            .Include(p => p.DefaultUnit)
            .Include(p => p.SizeGroup)  // ← NEW: Include SizeGroup
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
                ProductUnitId = p.DefaultUnitId,
                ProductUnitName = p.DefaultUnit != null ? p.DefaultUnit.Name : null,
                ProductUnitSymbol = p.DefaultUnit != null ? p.DefaultUnit.Symbol : null,
                BasePrice = p.BasePrice,
                IsActive = p.IsActive,
                CreatedAt = p.CreatedAt,
                ItemCode = p.ItemCode,
                Sku = p.Sku,
                HSNCode = p.HSNCode,
                Supplier = p.Supplier,
                ClosingStock = p.ClosingStock,
                MinOrderQty = p.MinOrderQty,
                MaxOrderQty = p.MaxOrderQty,
                // ── NEW: Size Group ──
                SizeGroupId = p.SizeGroupId,
                SizeGroupName = p.SizeGroup != null ? p.SizeGroup.Name : null,
                // ── NEW: UQC ──
                UQC = p.DefaultUnit != null ? p.DefaultUnit.UQC : null,
                UnitSize = p.UnitSize,
                Incentive = p.Incentive,
            })
            .ToListAsync(cancellationToken);

        return Result<List<ProductDto>>.Success(products);
    }
}