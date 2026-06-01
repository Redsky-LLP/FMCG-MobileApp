using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetProductProfitabilityQuery : IRequest<Result<List<ProductProfitabilityDto>>>
{
    public Guid? ProductGroupId { get; set; }
    public bool? ShowOnlyNegativeMargin { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}

public class ProductProfitabilityDto
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductNameMalayalam { get; set; }
    public Guid ProductGroupId { get; set; }
    public string ProductGroupName { get; set; } = string.Empty;
    public decimal TotalQuantity { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
    public int OrderCount { get; set; }
    public bool IsProfitable => TotalVariance > 0;
}