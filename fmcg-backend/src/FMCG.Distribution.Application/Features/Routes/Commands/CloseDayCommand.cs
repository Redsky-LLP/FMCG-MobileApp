using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// PATH: src/FMCG.Distribution.Application/Features/Routes/Commands/CloseDayCommand.cs
using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

/// <summary>
/// Admin-only action that closes the still-open route execution(s) for ONE
/// route — e.g. closing Chengannur does not touch Mavelikkara. This is what
/// makes THAT route "fresh" again: once its execution is Completed, nothing
/// matches it as the active/in-progress execution for that route anymore,
/// so starting that route again creates a brand new execution/cycle. Other
/// routes keep running untouched.
///
/// Unlike the salesman-facing CompleteRouteExecutionCommand, this does NOT
/// require all stops to be visited — admin closing a route is a hard
/// cutoff, not a "did you finish" check. Whatever wasn't visited just stays
/// Pending on the closed (historical) record.
/// </summary>
public class CloseDayCommand : IRequest<Result<CloseDayResponse>>
{
    public Guid AdminUserId { get; set; }
    public Guid RouteId { get; set; }
}

public class CloseDayResponse
{
    public int ClosedRouteCount { get; set; }
    public List<string> ClosedRouteNames { get; set; } = [];
}