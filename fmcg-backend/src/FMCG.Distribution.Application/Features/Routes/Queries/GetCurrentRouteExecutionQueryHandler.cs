// PATH: src/FMCG.Distribution.Application/Features/Routes/Queries/GetCurrentRouteExecutionQueryHandler.cs
// FIXES:
//   IDE0290: Use primary constructor
//   CA1860:  .Any() → .Count > 0
//   IDE0028: Collection initialization simplified

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetCurrentRouteExecutionQueryHandler(IApplicationDbContext context)  // IDE0290
    : IRequestHandler<GetCurrentRouteExecutionQuery, Result<CurrentRouteExecutionDto>>
{
    public async Task<Result<CurrentRouteExecutionDto>> Handle(
        GetCurrentRouteExecutionQuery request,
        CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;

        var execution = await context.RouteExecutions
            .Include(e => e.Visits!)
                .ThenInclude(v => v.Customer)
            .FirstOrDefaultAsync(
                e => e.RouteId == request.RouteId
                  && e.SalesmanId == request.SalesmanId
                  && e.ExecutionDate.Date == today
                  && e.Status != ExecutionStatus.Completed
                  && e.Status != ExecutionStatus.Abandoned,
                cancellationToken);

        if (execution == null)
        {
            return Result<CurrentRouteExecutionDto>.Success(new CurrentRouteExecutionDto
            {
                HasActiveExecution = false
            });
        }

        // FIX: If execution is still Draft (Start() result was never persisted), start it now
        if (execution.Status == ExecutionStatus.Draft)
        {
            execution.Start();
            await context.SaveChangesAsync(cancellationToken);
        }

        // ── Sync: add visits for customers added after execution started ──────
        var routeCustomers = await context.Customers
            .Where(c => c.RouteId == request.RouteId && c.IsActive && !c.IsDeleted)
            .OrderBy(c => c.SequenceOrder)
            .ToListAsync(cancellationToken);

        var existingVisitCustomerIds = execution.Visits?
            .Select(v => v.CustomerId)
            .ToHashSet() ?? [];   // IDE0028

        var missingCustomers = routeCustomers
            .Where(c => !existingVisitCustomerIds.Contains(c.Id))
            .ToList();

        if (missingCustomers.Count > 0)  // CA1860
        {
            int maxSeq = execution.Visits?.Count > 0  // CA1860
                ? execution.Visits.Max(v => v.SequenceOrder)
                : 0;

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

            await context.CustomerVisits.AddRangeAsync(newVisits, cancellationToken);
            await context.SaveChangesAsync(cancellationToken);

            // Reload with new visits
            execution = await context.RouteExecutions
                .Include(e => e.Visits!)
                    .ThenInclude(v => v.Customer)
                .FirstAsync(e => e.Id == execution.Id, cancellationToken);
        }
        // ─────────────────────────────────────────────────────────────────────

        var route = await context.Routes
            .FirstOrDefaultAsync(r => r.Id == execution.RouteId && !r.IsDeleted, cancellationToken);

        var visits = execution.Visits ?? [];   // IDE0028
        var total = visits.Count;
        var completed = visits.Count(v => v.Status != VisitStatus.Pending);
        var pending = visits.Count(v => v.Status == VisitStatus.Pending);

        // Auto-fix SequenceOrder=0: assign 1,2,3... if all are 0
        var orderedVisits = visits.All(v => v.SequenceOrder == 0)
            ? visits.Select((v, idx) => { v.SequenceOrder = idx + 1; return v; }).ToList()
            : [.. visits.OrderBy(v => v.SequenceOrder)];   // IDE0305

        var customers = orderedVisits.Select(v => new CustomerVisitStatusDto   // IDE0305
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

        return Result<CurrentRouteExecutionDto>.Success(new CurrentRouteExecutionDto
        {
            HasActiveExecution = true,
            ExecutionId = execution.Id,
            Status = execution.Status.ToString(),
            ExecutionDate = execution.ExecutionDate,
            RouteName = route?.Name ?? string.Empty,
            TotalCustomers = total,
            CompletedCount = completed,
            PendingCount = pending,
            Customers = customers,
        });
    }
}