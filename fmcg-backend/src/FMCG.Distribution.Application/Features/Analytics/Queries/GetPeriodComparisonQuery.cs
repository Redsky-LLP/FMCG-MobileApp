using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Analytics.DTOs;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetPeriodComparisonQuery : IRequest<Result<PeriodComparisonResponseDto>>
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public bool CompareWithPrevious { get; set; } = true;
    public Guid? RouteId { get; set; }
}