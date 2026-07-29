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
            .AsNoTracking()
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
            // ── Item group grouping/order unchanged (still by ProductGroupId, as before).
            // NEW secondary sort: within each item group, products now follow the same
            // size-group priority order used by the Loading Sheet / Billing Sheet reports
            // (SizeGroup.SortOrder — 50 KG BAG, 30 KG BAG, 26 KG BAG, 20 KG BAG, 20 LTR CASE,
            // 10 LTR CASE, 15 LTR TIN, 5 LTR CAN, in that order, same as the reorder-able
            // priority set from the Size Groups admin screen). A product whose size group has
            // no priority assigned yet (SortOrder = -1, or no size group at all) sorts to the
            // end of its item group instead of interleaving randomly. Name is still the final
            // tie-breaker for products that land on the same priority. ──
            // ── UPDATED: Client asked for a simple A-Z alphabetical list, to make finding
            // a product easier by scanning — replaces the previous Item Group → Size Group
            // → name grouping. ToUpper() ensures the sort is case-insensitive (so a product
            // typed as "chilly..." sorts alongside "Chilly...", not after every capitalized
            // name due to ASCII ordering putting lowercase letters after uppercase ones). ──
            .OrderBy(p => p.NameEnglish.ToUpper())
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
                // ── NEW: Out of Stock ──
                IsOutOfStock = p.IsOutOfStock,
                OutOfStockReason = p.OutOfStockReason,
                OutOfStockMarkedAt = p.OutOfStockMarkedAt,
            })
            .ToListAsync(cancellationToken);

        return Result<List<ProductDto>>.Success(products);
    }
}