using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// PATH: src/FMCG.Distribution.Application/Features/Settlement/Commands/ReopenRouteCommand.cs
using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Features.Settlement.Commands;

/// <summary>
/// Undoes a route closure — the counter-action to CloseOperationalDayCommand.
/// Re-locks nothing; instead it unlocks the orders that closure locked,
/// reverts the ones it flipped Draft→Closed back to Draft, reopens the
/// RouteExecution(s) that closure completed, and deactivates the closure
/// record so the route shows as open again.
///
/// Blocked if either:
///  - a newer, already-InProgress execution exists for this route (the
///    salesman already started a fresh cycle — undo would collide with it), or
///  - any order in the batch has already started being packed by warehouse.
/// </summary>
public class ReopenRouteCommand : IRequest<Result<ReopenRouteResultDto>>
{
    public DateTime ClosureDate { get; set; }
    public Guid RouteId { get; set; }
    public Guid AdminId { get; set; }
}

public class ReopenRouteResultDto
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int OrdersUnlocked { get; set; }
    public int ExecutionsReopened { get; set; }
    public int ResetVisitsCount { get; set; }  // ← ADD THIS
    public DateTime? ExecutionDate { get; set; }  // ← ADD THIS
}