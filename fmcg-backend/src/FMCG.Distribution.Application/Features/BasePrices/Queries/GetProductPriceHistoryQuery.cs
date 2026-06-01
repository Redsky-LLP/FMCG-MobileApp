using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.BasePrices.Queries;

public class GetProductPriceHistoryQuery : IRequest<Result<List<ProductPriceHistoryDto>>>
{
    public Guid ProductId { get; set; }
    public int? Limit { get; set; }
}

public class ProductPriceHistoryDto
{
    public Guid Id { get; set; }
    public decimal Price { get; set; }
    public decimal? PreviousPrice { get; set; }  // NEW - shows previous price
    public DateTime EffectiveDate { get; set; }
    public bool IsActive { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }
}