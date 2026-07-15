// PATH: src/FMCG.Distribution.Application/Common/Interfaces/ISettlementService.cs
using FMCG.Distribution.Application.Features.Settlement.DTOs;
using FMCG.Distribution.Application.Features.Settlement.Commands;

namespace FMCG.Distribution.Application.Common.Interfaces;

public interface ISettlementService
{
    Task<ExpectedCashDto> CalculateExpectedCashAsync(Guid? routeId, DateTime? date, CancellationToken cancellationToken = default);

    Task<ClosureValidationDto> ValidateSettlementBeforeClosureAsync(Guid? routeId, DateTime? date, CancellationToken cancellationToken = default);

    Task<OutstandingSummaryDto> GetOutstandingTotalsAsync(Guid? routeId, Guid? customerId, CancellationToken cancellationToken = default);

    Task<DailyClosureResultDto> CloseOperationalDayAsync(Guid closedByUserId, DateTime closureDate, Guid routeId, string? notes, CancellationToken cancellationToken = default);

    // ── NEW: the undo action ──
    Task<ReopenRouteResultDto> ReopenRouteAsync(Guid adminUserId, DateTime closureDate, Guid routeId, CancellationToken cancellationToken = default);
}