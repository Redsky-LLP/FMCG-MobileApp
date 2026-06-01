using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Features.Settlement.Queries;

public class GetSettlementSummaryQueryHandler(ISettlementService settlementService)
    : IRequestHandler<GetSettlementSummaryQuery, Result<ExpectedCashDto>>
{
    public async Task<Result<ExpectedCashDto>> Handle(GetSettlementSummaryQuery request, CancellationToken cancellationToken)
    {
        var result = await settlementService.CalculateExpectedCashAsync(
            request.RouteId,
            request.AsOfDate,
            cancellationToken);

        return Result<ExpectedCashDto>.Success(result);
    }
}