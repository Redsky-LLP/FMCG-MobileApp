using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

// Restored: this is the "all active routes are visible to every salesman" listing
// the product is designed around — admin coordinates who takes what informally
// (WhatsApp/call), and the system just needs to show what's available vs. already
// started by someone else today. See GetActiveRoutesQueryHandler for the locking
// semantics tied to StartRouteExecutionCommandHandler.
public class GetActiveRoutesQuery : IRequest<Result<List<ActiveRouteDto>>>
{
    public Guid SalesmanId { get; set; }
}

public class ActiveRouteDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int CustomerCount { get; set; }
    public bool IsActive { get; set; }
    public bool IsStarted { get; set; }
    public string? StartedBy { get; set; }
    public Guid? StartedBySalesmanId { get; set; }
    public bool IsMine { get; set; }
    // True when the route has a permanent AssignedSalesmanId set to someone else —
    // i.e. it's a dedicated route, not open for anyone to pick up.
    public bool IsDedicatedToAnother { get; set; }
}