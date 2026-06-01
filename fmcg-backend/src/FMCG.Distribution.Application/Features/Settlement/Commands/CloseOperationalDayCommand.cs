using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Features.Settlement.Commands;

public class CloseOperationalDayCommand : IRequest<Result<DailyClosureResultDto>>
{
    public DateTime ClosureDate { get; set; }
    public string? Notes { get; set; }
    public Guid AdminId { get; set; }
}