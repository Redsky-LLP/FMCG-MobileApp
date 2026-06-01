using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Features.Settlement.Queries;

public class GetOutstandingByCustomerQueryHandler(ISettlementService settlementService)
    : IRequestHandler<GetOutstandingByCustomerQuery, Result<OutstandingSummaryDto>>
{
    public async Task<Result<OutstandingSummaryDto>> Handle(GetOutstandingByCustomerQuery request, CancellationToken cancellationToken)
    {
        var result = await settlementService.GetOutstandingTotalsAsync(
            request.RouteId,
            request.CustomerId,
            cancellationToken);

        return Result<OutstandingSummaryDto>.Success(result);
    }
}