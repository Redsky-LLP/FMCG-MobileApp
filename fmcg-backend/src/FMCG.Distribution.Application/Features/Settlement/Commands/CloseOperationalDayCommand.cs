// PATH: src/FMCG.Distribution.Application/Features/Settlement/Commands/CloseOperationalDayCommand.cs
using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Features.Settlement.Commands;

public class CloseOperationalDayCommand : IRequest<Result<DailyClosureResultDto>>
{
    public DateTime ClosureDate { get; set; }
    // ── NEW: which route this close applies to — required, closes are
    // always scoped to a single route now (Chengannur, Mavelikkara, etc). ──
    public Guid RouteId { get; set; }
    public string? Notes { get; set; }
    public Guid AdminId { get; set; }
}