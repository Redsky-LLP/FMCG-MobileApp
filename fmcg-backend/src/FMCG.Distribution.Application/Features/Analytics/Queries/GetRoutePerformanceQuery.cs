using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Analytics.DTOs;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetRoutePerformanceQuery : IRequest<Result<RoutePerformanceResponseDto>>
{
    public Guid? RouteId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}