using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Incentives.DTOs;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetSalesmanIncentiveQuery : IRequest<Result<SalesmanIncentiveSummaryDto>>
{
    public Guid? SalesmanId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}