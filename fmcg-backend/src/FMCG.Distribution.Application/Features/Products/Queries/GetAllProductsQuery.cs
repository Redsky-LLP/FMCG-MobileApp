using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Products.Queries;

public class GetAllProductsQuery : IRequest<Result<List<ProductDto>>>
{
    public Guid? ProductGroupId { get; set; }
    public bool? IsActive { get; set; }
}

public class ProductDto
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public Guid ProductGroupId { get; set; }
    public string? ProductGroupName { get; set; }
    public Guid ProductUnitId { get; set; }
    public string? ProductUnitName { get; set; }
    public string? ProductUnitSymbol { get; set; }
    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }

    // ── Client-requested fields ──
    public string? ItemCode { get; set; }
    public string? Sku { get; set; }
    public string? HSNCode { get; set; }
    public string? Supplier { get; set; }
    public decimal ClosingStock { get; set; }
    public decimal? MinOrderQty { get; set; }
    public decimal? MaxOrderQty { get; set; }

    // ── NEW FIELDS ──
    public decimal? UnitSize { get; set; }
    public decimal? Incentive { get; set; }


    // ── NEW: Size Group ──
    public Guid? SizeGroupId { get; set; }
    public string? SizeGroupName { get; set; }

    // ── NEW: UQC (Unit Quantity Code) ──
    public string? UQC { get; set; }
}