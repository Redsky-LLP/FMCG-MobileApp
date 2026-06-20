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
/// Admin-only, single action that closes EVERY still-open route execution at
/// once — not per-route. This is what makes routes "fresh" again for the
/// next day: once an execution is Completed, nothing matches it as the
/// active/in-progress execution for that route anymore, so starting that
/// route again creates a brand new execution.
///
/// Unlike the salesman-facing CompleteRouteExecutionCommand, this does NOT
/// require all stops to be visited — admin closing the day is a hard cutoff,
/// not a "did you finish" check. Whatever wasn't visited just stays Pending
/// on the closed (historical) record.
/// </summary>
public class CloseDayCommand : IRequest<Result<CloseDayResponse>>
{
    public Guid AdminUserId { get; set; }
}

public class CloseDayResponse
{
    public int ClosedRouteCount { get; set; }
    public List<string> ClosedRouteNames { get; set; } = [];
}