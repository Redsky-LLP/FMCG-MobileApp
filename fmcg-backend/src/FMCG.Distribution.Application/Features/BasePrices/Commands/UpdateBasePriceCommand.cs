using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.BasePrices.Commands;

public class UpdateBasePriceCommand : IRequest<Result<UpdateBasePriceResponse>>
{
    public Guid ProductId { get; set; }
    public decimal NewPrice { get; set; }
    public string? Reason { get; set; }
    public Guid AdminId { get; set; }
}

public class UpdateBasePriceResponse
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal OldPrice { get; set; }
    public decimal NewPrice { get; set; }
    public DateTime EffectiveDate { get; set; }
}