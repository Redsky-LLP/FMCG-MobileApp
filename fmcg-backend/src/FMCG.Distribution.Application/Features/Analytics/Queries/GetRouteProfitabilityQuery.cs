using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetRouteProfitabilityQuery : IRequest<Result<List<RouteProfitabilityDto>>>
{
    public Guid? RouteId { get; set; }
    public bool? ShowOnlyNegativeMargin { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}

public class RouteProfitabilityDto
{
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
    public int OrderCount { get; set; }
    public int CustomerCount { get; set; }
    public bool IsProfitable => TotalVariance > 0;
}