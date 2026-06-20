using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
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
        var today = DateTime.UtcNow.Date;

        // Every active route is visible to every salesman — there is no admin
        // "assign route to salesman" step required for day-to-day use.
        var routes = await _context.Routes
            .Include(r => r.Customers)
            .Where(r => r.IsActive && !r.IsDeleted)
            .OrderBy(r => r.SequenceOrder)
            .ToListAsync(cancellationToken);

        // Today's executions across ALL salesmen — this is what makes a route
        // show as "taken" to everyone else once one salesman starts it.
        var executions = await _context.RouteExecutions
            .Include(e => e.Salesman)
            .Where(e => e.ExecutionDate.Date == today
                        && e.Status != ExecutionStatus.Completed
                        && e.Status != ExecutionStatus.Abandoned
                        && !e.IsDeleted)
            .ToDictionaryAsync(e => e.RouteId, e => e, cancellationToken);

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
            };
        }).ToList();

        return Result<List<ActiveRouteDto>>.Success(result);
    }
}