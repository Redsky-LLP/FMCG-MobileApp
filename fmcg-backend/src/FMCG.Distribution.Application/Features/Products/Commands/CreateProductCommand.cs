using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Products.Commands;

public class CreateProductCommand : IRequest<Result<CreateProductResponse>>
{
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public Guid ProductGroupId { get; set; }
    public Guid ProductUnitId { get; set; }
    public decimal BasePrice { get; set; }
    public string? ItemCode { get; set; }
    public string? Sku { get; set; }
    public string? HSNCode { get; set; }
    public string? Supplier { get; set; }
    public decimal? ClosingStock { get; set; }
    public decimal? MinOrderQty { get; set; }
    public decimal? MaxOrderQty { get; set; }
    // ── NEW: Size Group ──
    public Guid? SizeGroupId { get; set; }
}

public class CreateProductResponse
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public Guid ProductGroupId { get; set; }
    public Guid ProductUnitId { get; set; }
    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; }
    public string? ItemCode { get; set; }
    // ── NEW: Size Group ──
    public Guid? SizeGroupId { get; set; }
}