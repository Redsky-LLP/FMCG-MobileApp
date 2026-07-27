using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// PATH: src/FMCG.Distribution.Application/Features/Routes/Queries/GetCurrentRouteExecutionsBatchQueryHandler.cs

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetCurrentRouteExecutionsBatchQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetCurrentRouteExecutionsBatchQuery, Result<List<RouteExecutionSummaryDto>>>
{
    public async Task<Result<List<RouteExecutionSummaryDto>>> Handle(
        GetCurrentRouteExecutionsBatchQuery request,
        CancellationToken cancellationToken)
    {
        var routeIds = request.RouteIds.Distinct().ToList();
        if (routeIds.Count == 0)
            return Result<List<RouteExecutionSummaryDto>>.Success([]);

        // ── Batch read #1: every open execution across every requested route, in
        // one query. NOTE: deliberately NOT using AsNoTracking here — Start() below
        // mutates these entities and they need to stay tracked for SaveChanges to
        // persist that change, same reasoning as the single-route handler. ──
        var executions = await context.RouteExecutions
            .Include(e => e.Visits!)
                .ThenInclude(v => v.Customer)
            .Where(e => routeIds.Contains(e.RouteId)
                && e.SalesmanId == request.SalesmanId
                && e.Status != ExecutionStatus.Completed
                && e.Status != ExecutionStatus.Abandoned)
            .ToListAsync(cancellationToken);

        // Most recent open execution per route (mirrors the single-route handler's
        // OrderByDescending(ExecutionDate).FirstOrDefault()).
        var executionByRoute = executions
            .GroupBy(e => e.RouteId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(e => e.ExecutionDate).First());

        // ── Batch read #2: every active customer across every requested route,
        // read-only — never mutated, safe to skip change-tracking for. ──
        var allCustomers = await context.Customers
            .AsNoTracking()
            .Where(c => routeIds.Contains(c.RouteId) && c.IsActive && !c.IsDeleted)
            .OrderBy(c => c.SequenceOrder)
            .ToListAsync(cancellationToken);

        var customersByRoute = allCustomers
            .GroupBy(c => c.RouteId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // ── Batch read #3: route names, read-only. ──
        var routeNames = await context.Routes
            .AsNoTracking()
            .Where(r => routeIds.Contains(r.Id) && !r.IsDeleted)
            .Select(r => new { r.Id, r.Name })
            .ToDictionaryAsync(r => r.Id, r => r.Name, cancellationToken);

        // ── First pass: apply any needed self-healing (auto-start Draft executions,
        // auto-add visits for customers added after the execution started) entirely
        // in memory, across ALL routes, collecting the results so only ONE
        // SaveChanges call is needed for everything combined — instead of up to two
        // per route as the single-route handler does. ──
        var newVisitsToAdd = new List<CustomerVisit>();
        var visitsByRoute = new Dictionary<Guid, List<CustomerVisit>>();
        var anyChangesMade = false;

        foreach (var routeId in routeIds)
        {
            if (!executionByRoute.TryGetValue(routeId, out var execution))
                continue;

            if (execution.Status == ExecutionStatus.Draft)
            {
                execution.Start();
                anyChangesMade = true;
            }

            var routeCustomers = customersByRoute.GetValueOrDefault(routeId, []);
            var currentVisits = execution.Visits?.ToList() ?? [];
            var existingVisitCustomerIds = currentVisits.Select(v => v.CustomerId).ToHashSet();

            var missingCustomers = routeCustomers
                .Where(c => !existingVisitCustomerIds.Contains(c.Id))
                .ToList();

            if (missingCustomers.Count > 0)
            {
                var maxSeq = currentVisits.Count > 0 ? currentVisits.Max(v => v.SequenceOrder) : 0;

                var newVisits = missingCustomers
                    .Select((c, idx) => new CustomerVisit
                    {
                        Id = Guid.NewGuid(),
                        RouteExecutionId = execution.Id,
                        CustomerId = c.Id,
                        SequenceOrder = c.SequenceOrder > 0 ? c.SequenceOrder : maxSeq + idx + 1,
                        Status = VisitStatus.Pending
                    })
                    .ToList();

                newVisitsToAdd.AddRange(newVisits);
                currentVisits.AddRange(newVisits);
                anyChangesMade = true;
            }

            visitsByRoute[routeId] = currentVisits;
        }

        // ── Single combined write for everything collected above. Only runs at all
        // if some route actually needed healing — most requests hit zero writes here. ──
        if (anyChangesMade)
        {
            if (newVisitsToAdd.Count > 0)
                await context.CustomerVisits.AddRangeAsync(newVisitsToAdd, cancellationToken);

            await context.SaveChangesAsync(cancellationToken);
        }

        // ── Second pass: build the response DTOs from what's already in memory —
        // no reload needed, since we already know exactly what was just written. ──
        var results = new List<RouteExecutionSummaryDto>();

        foreach (var routeId in routeIds)
        {
            if (!executionByRoute.TryGetValue(routeId, out var execution))
            {
                results.Add(new RouteExecutionSummaryDto
                {
                    RouteId = routeId,
                    HasActiveExecution = false
                });
                continue;
            }

            var visits = visitsByRoute.GetValueOrDefault(routeId, []);

            // Auto-fix SequenceOrder=0: assign 1,2,3... if all are 0 (same as before).
            var orderedVisits = visits.All(v => v.SequenceOrder == 0)
                ? visits.Select((v, idx) => { v.SequenceOrder = idx + 1; return v; }).ToList()
                : [.. visits.OrderBy(v => v.SequenceOrder)];

            var total = orderedVisits.Count;
            var completed = orderedVisits.Count(v => v.Status != VisitStatus.Pending);
            var pending = orderedVisits.Count(v => v.Status == VisitStatus.Pending);

            var customerDtos = orderedVisits.Select(v => new CustomerVisitStatusDto
            {
                VisitId = v.Id,
                CustomerId = v.CustomerId,
                CustomerName = v.Customer?.NameEnglish ?? string.Empty,
                CustomerNameMalayalam = v.Customer?.NameMalayalam,
                PhoneNumber = v.Customer?.PhoneNumber,
                Address = v.Customer?.Address,
                SequenceOrder = v.SequenceOrder,
                VisitStatus = v.Status.ToString(),
                OrderId = v.OrderId,
                SkipReason = v.SkipReason,
            }).ToList();

            results.Add(new RouteExecutionSummaryDto
            {
                RouteId = routeId,
                HasActiveExecution = true,
                ExecutionId = execution.Id,
                Status = execution.Status.ToString(),
                ExecutionDate = execution.ExecutionDate,
                RouteName = routeNames.GetValueOrDefault(routeId, string.Empty),
                TotalCustomers = total,
                CompletedCount = completed,
                PendingCount = pending,
                Customers = customerDtos,
            });
        }

        return Result<List<RouteExecutionSummaryDto>>.Success(results);
    }
}