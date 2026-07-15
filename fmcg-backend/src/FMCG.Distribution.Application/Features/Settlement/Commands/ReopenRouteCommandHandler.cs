using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// PATH: src/FMCG.Distribution.Application/Features/Settlement/Commands/ReopenRouteCommandHandler.cs
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using MediatR;

namespace FMCG.Distribution.Application.Features.Settlement.Commands;

public class ReopenRouteCommandHandler(ISettlementService settlementService)
    : IRequestHandler<ReopenRouteCommand, Result<ReopenRouteResultDto>>
{
    public async Task<Result<ReopenRouteResultDto>> Handle(ReopenRouteCommand request, CancellationToken cancellationToken)
    {
        var result = await settlementService.ReopenRouteAsync(
            request.AdminId,
            request.ClosureDate,
            request.RouteId,
            cancellationToken);

        if (!result.Success)
        {
            return Result<ReopenRouteResultDto>.Failure(result.Message ?? "Failed to reopen route.");
        }

        return Result<ReopenRouteResultDto>.Success(result, result.Message);
    }
}