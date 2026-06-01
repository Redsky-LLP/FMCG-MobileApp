using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Products.Queries;

public class SearchProductsQuery : IRequest<Result<List<ProductSearchDto>>>
{
    public string? SearchTerm { get; set; }
    public Guid? ProductGroupId { get; set; }
    public bool? IsActive { get; set; }
    public int Limit { get; set; } = 50;
}

public class ProductSearchDto
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public Guid ProductGroupId { get; set; }
    public string ProductGroupName { get; set; } = string.Empty;
    public Guid ProductUnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public string UnitSymbol { get; set; } = string.Empty;
    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; }
}