// PATH: src/FMCG.Distribution.Application/Features/Settlement/Commands/CloseOperationalDayCommandHandler.cs
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Settlement.DTOs;
using MediatR;

namespace FMCG.Distribution.Application.Features.Settlement.Commands;

public class CloseOperationalDayCommandHandler(ISettlementService settlementService)
    : IRequestHandler<CloseOperationalDayCommand, Result<DailyClosureResultDto>>
{
    public async Task<Result<DailyClosureResultDto>> Handle(CloseOperationalDayCommand request, CancellationToken cancellationToken)
    {
        var result = await settlementService.CloseOperationalDayAsync(
            request.AdminId,
            request.ClosureDate,
            request.RouteId,
            request.Notes,
            cancellationToken);

        if (!result.Success)
        {
            return Result<DailyClosureResultDto>.Failure(result.Message ?? "Failed to close route.");
        }

        return Result<DailyClosureResultDto>.Success(result, result.Message);
    }
}