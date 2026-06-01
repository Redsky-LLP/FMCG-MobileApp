using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class CompleteRouteExecutionCommandHandler : IRequestHandler<CompleteRouteExecutionCommand, Result<CompleteRouteExecutionResponse>>
{
    private readonly IApplicationDbContext _context;

    public CompleteRouteExecutionCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CompleteRouteExecutionResponse>> Handle(CompleteRouteExecutionCommand request, CancellationToken cancellationToken)
    {
        // Validate execution exists
        var execution = await _context.RouteExecutions
            .Include(e => e.Route)
            .Include(e => e.Visits)
            .FirstOrDefaultAsync(e => e.Id == request.ExecutionId && !e.IsDeleted, cancellationToken);

        if (execution == null)
        {
            return Result<CompleteRouteExecutionResponse>.Failure("Route execution not found.");
        }

        // Verify salesman owns this execution
        if (execution.SalesmanId != request.SalesmanId)
        {
            return Result<CompleteRouteExecutionResponse>.Failure("You are not authorized to complete this execution.");
        }

        if (execution.Status != ExecutionStatus.InProgress)
        {
            return Result<CompleteRouteExecutionResponse>.Failure($"Cannot complete execution. Status is '{execution.Status}'.");
        }

        // Check for any pending visits
        var pendingCount = execution.Visits?.Count(v => v.Status == VisitStatus.Pending) ?? 0;
        if (pendingCount > 0)
        {
            return Result<CompleteRouteExecutionResponse>.Failure($"Cannot complete execution. {pendingCount} customer(s) still pending.");
        }

        // Complete the execution
        execution.Complete();
        await _context.SaveChangesAsync(cancellationToken);

        // Calculate statistics
        var visits = execution.Visits ?? new List<CustomerVisit>();
        var orderCount = visits.Count(v => v.Status == VisitStatus.OrderPlaced && v.OrderId.HasValue);
        var skippedCount = visits.Count(v => v.Status == VisitStatus.Skipped);
        var noOrderCount = visits.Count(v => v.Status == VisitStatus.NoOrder);

        return Result<CompleteRouteExecutionResponse>.Success(new CompleteRouteExecutionResponse
        {
            ExecutionId = execution.Id,
            RouteId = execution.RouteId,
            RouteName = execution.Route?.Name ?? string.Empty,
            ExecutionDate = execution.ExecutionDate,
            Status = execution.Status.ToString(),
            TotalCustomers = visits.Count,
            VisitedCount = visits.Count(v => v.Status != VisitStatus.Pending),
            OrderCount = orderCount,
            SkippedCount = skippedCount,
            NoOrderCount = noOrderCount
        }, "Route execution completed successfully.");
    }
}