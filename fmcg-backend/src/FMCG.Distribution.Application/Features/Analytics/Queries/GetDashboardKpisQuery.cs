using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Analytics.DTOs;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetDashboardKpisQuery : IRequest<Result<DashboardKpisDto>>
{
    public DateTime? Date { get; set; }
}