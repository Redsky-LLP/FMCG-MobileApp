using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// PATH: src/FMCG.Distribution.Application/Features/Routes/Commands/CloseDayCommandHandler.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class CloseDayCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CloseDayCommand, Result<CloseDayResponse>>
{
    public async Task<Result<CloseDayResponse>> Handle(CloseDayCommand request, CancellationToken cancellationToken)
    {
        var openExecutions = await context.RouteExecutions
            .Include(e => e.Route)
            .Where(e => e.Status == ExecutionStatus.InProgress && !e.IsDeleted)
            .ToListAsync(cancellationToken);

        if (openExecutions.Count == 0)
        {
            return Result<CloseDayResponse>.Success(new CloseDayResponse
            {
                ClosedRouteCount = 0,
                ClosedRouteNames = [],
            }, "No open routes to close.");
        }

        var names = new List<string>();
        foreach (var execution in openExecutions)
        {
            // Domain method only checks Status == InProgress — it does NOT
            // require all stops visited, which is exactly what we want here:
            // admin closing the day is a hard cutoff, not a completion check.
            execution.Complete();
            names.Add(execution.Route?.Name ?? "Unknown route");
        }

        await context.SaveChangesAsync(cancellationToken);

        return Result<CloseDayResponse>.Success(new CloseDayResponse
        {
            ClosedRouteCount = openExecutions.Count,
            ClosedRouteNames = names,
        }, $"Closed {openExecutions.Count} route(s). They'll be fresh and available again.");
    }
}