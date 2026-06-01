using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Common.Interfaces;

public interface ISettlementService
{
    Task<ExpectedCashDto> CalculateExpectedCashAsync(Guid? routeId, DateTime? date, CancellationToken cancellationToken = default);
    Task<ClosureValidationDto> ValidateSettlementBeforeClosureAsync(Guid? routeId, DateTime? date, CancellationToken cancellationToken = default);
    Task<OutstandingSummaryDto> GetOutstandingTotalsAsync(Guid? routeId, Guid? customerId, CancellationToken cancellationToken = default);
    Task<DailyClosureResultDto> CloseOperationalDayAsync(Guid closedByUserId, DateTime closureDate, string? notes, CancellationToken cancellationToken = default);
}