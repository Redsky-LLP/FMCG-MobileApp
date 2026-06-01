using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Products.Queries;

public class GetProductByIdQuery : IRequest<Result<ProductDetailDto>>
{
    public Guid Id { get; set; }
}

public class ProductDetailDto
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public Guid ProductGroupId { get; set; }
    public string? ProductGroupName { get; set; }
    public string? ProductGroupDescription { get; set; }
    public Guid ProductUnitId { get; set; }
    public string? ProductUnitName { get; set; }
    public string? ProductUnitSymbol { get; set; }
    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}