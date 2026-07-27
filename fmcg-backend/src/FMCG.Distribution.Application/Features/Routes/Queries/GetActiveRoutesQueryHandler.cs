using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetActiveRoutesQueryHandler : IRequestHandler<GetActiveRoutesQuery, Result<List<ActiveRouteDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetActiveRoutesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<ActiveRouteDto>>> Handle(GetActiveRoutesQuery request, CancellationToken cancellationToken)
    {
        // Every active route is visible to every salesman — there is no admin
        // "assign route to salesman" step required for day-to-day use.
        var routes = await _context.Routes
            .AsNoTracking()
            .Include(r => r.Customers)
            .Where(r => r.IsActive && !r.IsDeleted)
            .OrderBy(r => r.SequenceOrder)
            .ToListAsync(cancellationToken);

        // Open executions across ALL salesmen — not scoped to today's date.
        // An execution that's still InProgress/Draft from a previous day must
        // keep showing the route as "taken" until admin closes it; otherwise
        // a plain date rollover makes every route look free again on its own.
        // If a route somehow has more than one open execution, the most
        // recently started one wins.
        var executions = await _context.RouteExecutions
            .AsNoTracking()
            .Include(e => e.Salesman)
            .Where(e => e.Status != ExecutionStatus.Completed
                        && e.Status != ExecutionStatus.Abandoned
                        && !e.IsDeleted)
            .GroupBy(e => e.RouteId)
            .Select(g => g.OrderByDescending(e => e.ExecutionDate).First())
            .ToDictionaryAsync(e => e.RouteId, e => e, cancellationToken);

        // ── Global gate signal ─────────────────────────────────────────────
        // True if ANYTHING anywhere is still open — drives whether brand-new
        // routes are allowed to start. Cheap check: if the dictionary above has
        // any entries at all, something is open (it only contains open ones).
        var hasUnclosedCycle = executions.Count > 0;

        var result = routes.Select(r =>
        {
            var execution = executions.GetValueOrDefault(r.Id);
            var isStarted = execution != null;

            return new ActiveRouteDto
            {
                Id = r.Id,
                Name = r.Name,
                Description = r.Description,
                CustomerCount = r.Customers?.Count(c => !c.IsDeleted && c.IsActive) ?? 0,
                IsActive = r.IsActive,
                IsStarted = isStarted,
                StartedBy = execution?.Salesman?.FullName,
                StartedBySalesmanId = execution?.SalesmanId,
                IsMine = isStarted && execution?.SalesmanId == request.SalesmanId,
                // A route is only "closed off" if it's permanently dedicated to a
                // DIFFERENT specific salesman. Unassigned routes are open to anyone.
                IsDedicatedToAnother = r.AssignedSalesmanId.HasValue && r.AssignedSalesmanId != request.SalesmanId,
                HasUnclosedCycle = hasUnclosedCycle,
            };
        }).ToList();

        return Result<List<ActiveRouteDto>>.Success(result);
    }
}