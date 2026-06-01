using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Features.Settlement.Queries;

public class GetSettlementSummaryQuery : IRequest<Result<ExpectedCashDto>>
{
    public Guid? RouteId { get; set; }
    public DateTime? AsOfDate { get; set; }
}