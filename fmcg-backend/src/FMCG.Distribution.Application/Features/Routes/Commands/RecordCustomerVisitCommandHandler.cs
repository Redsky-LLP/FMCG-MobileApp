// PATH: src/FMCG.Distribution.Application/Features/Routes/Commands/RecordCustomerVisitCommandHandler.cs
// COMPLETE FIXED VERSION - Handles all edge cases properly

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class RecordCustomerVisitCommandHandler(IApplicationDbContext context)
    : IRequestHandler<RecordCustomerVisitCommand, Result<RecordCustomerVisitResponse>>
{
    public async Task<Result<RecordCustomerVisitResponse>> Handle(RecordCustomerVisitCommand request, CancellationToken cancellationToken)
    {
        // ── Validate execution exists and is in progress ──
        var execution = await context.RouteExecutions
            .Include(e => e.Visits!)
                .ThenInclude(v => v.Customer)
            .FirstOrDefaultAsync(e => e.Id == request.ExecutionId && !e.IsDeleted, cancellationToken);

        if (execution == null)
        {
            return Result<RecordCustomerVisitResponse>.Failure("Route execution not found.");
        }

        // ── Check if execution is already completed ──
        if (execution.Status == ExecutionStatus.Completed)
        {
            return Result<RecordCustomerVisitResponse>.Failure(
                "This route execution is already completed. Please refresh the page.");
        }

        if (execution.Status != ExecutionStatus.InProgress)
        {
            return Result<RecordCustomerVisitResponse>.Failure(
                $"Cannot record visit. Execution is in '{execution.Status}' status.");
        }

        // ── Verify salesman owns this execution ──
        if (execution.SalesmanId != request.SalesmanId)
        {
            return Result<RecordCustomerVisitResponse>.Failure("You are not authorized to modify this execution.");
        }

        // ── Find the visit by CustomerId ──
        var visit = execution.Visits?.FirstOrDefault(v => v.CustomerId == request.CustomerId);

        if (visit == null)
        {
            // Try to find by OrderId if provided
            if (request.OrderId.HasValue)
            {
                visit = execution.Visits?.FirstOrDefault(v => v.OrderId == request.OrderId.Value);
            }

            if (visit == null)
            {
                return Result<RecordCustomerVisitResponse>.Failure("Customer visit not found in this execution.");
            }
        }

        // ── CRITICAL FIX: If visit is already recorded, return success without changing ──
        // Don't allow changing status if already recorded (prevent OrderPlaced → NoOrder)
        if (visit.Status != VisitStatus.Pending)
        {
            var customer = await context.Customers
                .FirstOrDefaultAsync(c => c.Id == request.CustomerId, cancellationToken);

            var completedCount = execution.Visits!.Count(v => v.Status != VisitStatus.Pending);
            var totalCount = execution.Visits.Count;
            var isComplete = completedCount == totalCount;

            return Result<RecordCustomerVisitResponse>.Success(new RecordCustomerVisitResponse
            {
                VisitId = visit.Id,
                CustomerId = visit.CustomerId,
                CustomerName = customer?.NameEnglish ?? string.Empty,
                Status = visit.Status,
                SequenceOrder = visit.SequenceOrder,
                CompletedCount = completedCount,
                TotalCount = totalCount,
                IsExecutionComplete = isComplete
            }, $"Visit already recorded as {visit.Status}.");
        }

        // ── Get customer name for response ──
        var customerInfo = await context.Customers
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId, cancellationToken);

        // ── Record the visit based on status ──
        switch (request.Status)
        {
            case VisitStatus.OrderPlaced:
                if (!request.OrderId.HasValue)
                {
                    return Result<RecordCustomerVisitResponse>.Failure("OrderId is required when status is OrderPlaced.");
                }
                visit.RecordOrder(request.OrderId.Value);
                break;

            case VisitStatus.Skipped:
                visit.RecordSkip(request.SkipReason);
                break;

            case VisitStatus.NoOrder:
                visit.RecordNoOrder();
                break;

            default:
                return Result<RecordCustomerVisitResponse>.Failure($"Invalid visit status: {request.Status}");
        }

        await context.SaveChangesAsync(cancellationToken);

        // ── Calculate completion stats ──
        var completedCountAfter = execution.Visits!.Count(v => v.Status != VisitStatus.Pending);
        var totalCountAfter = execution.Visits.Count;
        var isCompleteAfter = completedCountAfter == totalCountAfter;

        // ── If all visits are completed, auto-complete the execution ──
        if (isCompleteAfter)
        {
            execution.Status = ExecutionStatus.Completed;
            execution.CompletedAt = DateTime.UtcNow;
            execution.UpdatedAt = DateTime.UtcNow;
            execution.UpdatedBy = request.SalesmanId.ToString();
            await context.SaveChangesAsync(cancellationToken);
        }

        return Result<RecordCustomerVisitResponse>.Success(new RecordCustomerVisitResponse
        {
            VisitId = visit.Id,
            CustomerId = visit.CustomerId,
            CustomerName = customerInfo?.NameEnglish ?? string.Empty,
            Status = visit.Status,
            SequenceOrder = visit.SequenceOrder,
            CompletedCount = completedCountAfter,
            TotalCount = totalCountAfter,
            IsExecutionComplete = isCompleteAfter
        }, $"Visit recorded as {request.Status}.");
    }
}