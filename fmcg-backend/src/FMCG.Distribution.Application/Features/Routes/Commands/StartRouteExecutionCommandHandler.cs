// PATH: src/FMCG.Distribution.Application/Features/Routes/Commands/StartRouteExecutionCommandHandler.cs
// UPDATED: Delivery mode now requires day closure and CLOSED orders

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;                           // ← ADD THIS
using Microsoft.EntityFrameworkCore;      // ← ADD THIS
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class StartRouteExecutionCommandHandler(IApplicationDbContext context)
    : IRequestHandler<StartRouteExecutionCommand, Result<StartRouteExecutionResponse>>
{
    public async Task<Result<StartRouteExecutionResponse>> Handle(
        StartRouteExecutionCommand request,
        CancellationToken cancellationToken)
    {
        var route = await context.Routes
            .Include(r => r.Customers!.Where(c => !c.IsDeleted && c.IsActive))
            .FirstOrDefaultAsync(r => r.Id == request.RouteId && !r.IsDeleted, cancellationToken);

        if (route == null)
            return Result<StartRouteExecutionResponse>.Failure("Route not found.");

        var salesman = await context.Users
            .FirstOrDefaultAsync(u => u.Id == request.SalesmanId
                && u.Role == UserRole.Salesman && u.IsActive, cancellationToken);

        if (salesman == null)
            return Result<StartRouteExecutionResponse>.Failure("Salesman not found or not authorized.");

        if (route.AssignedSalesmanId != request.SalesmanId)
            return Result<StartRouteExecutionResponse>.Failure("You are not assigned to this route.");

        var executionDate = request.ExecutionDate.HasValue && request.IsAdmin
            ? request.ExecutionDate.Value.Date
            : DateTime.UtcNow.Date;

        // Resume existing execution if any
        var existingExecution = await context.RouteExecutions
            .FirstOrDefaultAsync(e => e.RouteId == request.RouteId
                && e.ExecutionDate.Date == executionDate
                && e.Status != ExecutionStatus.Completed
                && e.Status != ExecutionStatus.Abandoned, cancellationToken);

        if (existingExecution != null)
        {
            if (existingExecution.Status == ExecutionStatus.Draft)
            {
                existingExecution.Start();
                await context.SaveChangesAsync(cancellationToken);
            }

            if (!request.IsOrderTaking)
                await SyncNewOrdersToVisits(existingExecution.Id, route.Id, executionDate, cancellationToken);

            var totalCustomers = await context.CustomerVisits
                .CountAsync(v => v.RouteExecutionId == existingExecution.Id && !v.IsDeleted, cancellationToken);

            return Result<StartRouteExecutionResponse>.Success(new StartRouteExecutionResponse
            {
                ExecutionId = existingExecution.Id,
                RouteId = route.Id,
                RouteName = route.Name,
                ExecutionDate = existingExecution.ExecutionDate,
                Status = existingExecution.Status.ToString(),
                TotalCustomers = totalCustomers,
                IsOrderTaking = existingExecution.ExecutionType == ExecutionType.OrderTaking,
            }, "Resuming existing route execution.");
        }

        // Guard: no other active execution on a different route today
        var existingActiveExecution = await context.RouteExecutions
            .FirstOrDefaultAsync(e => e.SalesmanId == request.SalesmanId
                && e.ExecutionDate.Date == executionDate
                && e.RouteId != request.RouteId
                && e.Status != ExecutionStatus.Completed
                && e.Status != ExecutionStatus.Abandoned, cancellationToken);

        if (existingActiveExecution != null)
        {
            var activeRoute = await context.Routes
                .FirstOrDefaultAsync(r => r.Id == existingActiveExecution.RouteId, cancellationToken);
            return Result<StartRouteExecutionResponse>.Failure(
                $"You already have an active route execution for '{activeRoute?.Name}'. " +
                "Please complete that route before starting a new one.");
        }

        // Create new execution
        var execution = new RouteExecution
        {
            Id = Guid.NewGuid(),
            RouteId = request.RouteId,
            SalesmanId = request.SalesmanId,
            ExecutionDate = executionDate,
            Status = ExecutionStatus.Draft,
            ExecutionType = request.IsOrderTaking ? ExecutionType.OrderTaking : ExecutionType.Delivery,
        };

        await context.RouteExecutions.AddAsync(execution, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        execution.Start();

        List<Customer> customersToVisit;
        string successMessage;

        if (request.IsOrderTaking)
        {
            // ORDER-TAKING MODE: all active customers
            customersToVisit = await context.Customers
                .Where(c => c.RouteId == route.Id && c.IsActive && !c.IsDeleted)
                .OrderBy(c => c.SequenceOrder)
                .ToListAsync(cancellationToken);

            if (customersToVisit.Count == 0)
            {
                context.RouteExecutions.Remove(execution);
                await context.SaveChangesAsync(cancellationToken);
                return Result<StartRouteExecutionResponse>.Failure(
                    "No customers assigned to this route. Please ask admin to assign customers.");
            }

            successMessage = $"Order-taking started with {customersToVisit.Count} customer(s).";
        }
        else
        {
            // DELIVERY MODE: Check if day is closed first
            var isDayClosed = await context.DailyClosures
                .AnyAsync(c => c.ClosureDate.Date == executionDate.Date && !c.IsDeleted, cancellationToken);

            if (!isDayClosed)
            {
                context.RouteExecutions.Remove(execution);
                await context.SaveChangesAsync(cancellationToken);
                return Result<StartRouteExecutionResponse>.Failure(
                    "Cannot start delivery. The day has not been closed by Admin yet. " +
                    "Please wait for admin to close today's operations before starting delivery.");
            }

            // Delivery mode: customers with CLOSED orders only
            customersToVisit = await GetCustomersWithClosedOrders(route.Id, executionDate, cancellationToken);

            if (customersToVisit.Count == 0)
            {
                context.RouteExecutions.Remove(execution);
                await context.SaveChangesAsync(cancellationToken);
                return Result<StartRouteExecutionResponse>.Failure(
                    "No closed orders ready for delivery on this route. " +
                    "Admin must close the orders before delivery can start.");
            }

            successMessage = $"Delivery started with {customersToVisit.Count} delivery(s).";
        }

        var orderedCustomers = customersToVisit.OrderBy(c => c.SequenceOrder).ToList();

        var visits = orderedCustomers.Select((c, idx) => new CustomerVisit
        {
            Id = Guid.NewGuid(),
            RouteExecutionId = execution.Id,
            CustomerId = c.Id,
            SequenceOrder = idx + 1,
            Status = request.IsOrderTaking ? VisitStatus.Pending : VisitStatus.OrderPlaced,
        });

        await context.CustomerVisits.AddRangeAsync(visits, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return Result<StartRouteExecutionResponse>.Success(new StartRouteExecutionResponse
        {
            ExecutionId = execution.Id,
            RouteId = route.Id,
            RouteName = route.Name,
            ExecutionDate = execution.ExecutionDate,
            Status = execution.Status.ToString(),
            TotalCustomers = customersToVisit.Count,
            IsOrderTaking = request.IsOrderTaking,
        }, successMessage);
    }

    /// <summary>
    /// Customers with CLOSED orders for the delivery date.
    /// Delivery only allowed after admin closes the orders.
    /// </summary>
    private async Task<List<Customer>> GetCustomersWithClosedOrders(
        Guid routeId,
        DateTime deliveryDate,
        CancellationToken cancellationToken)
    {
        var routeCustomers = await context.Customers
            .Where(c => c.RouteId == routeId && !c.IsDeleted && c.IsActive)
            .ToListAsync(cancellationToken);

        var customerIds = routeCustomers.Select(c => c.Id).ToList();

        // Only CLOSED orders can be delivered
        var customerIdsWithOrders = await context.Orders
            .Where(o => customerIds.Contains(o.CustomerId)
                && !o.IsDeleted
                && o.Status == OrderStatus.Closed
                && o.OrderDate.Date <= deliveryDate)
            .Select(o => o.CustomerId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return routeCustomers
            .Where(c => customerIdsWithOrders.Contains(c.Id))
            .ToList();
    }

    private async Task SyncNewOrdersToVisits(
        Guid executionId,
        Guid routeId,
        DateTime deliveryDate,
        CancellationToken cancellationToken)
    {
        var existingVisits = await context.CustomerVisits
            .Where(v => v.RouteExecutionId == executionId && !v.IsDeleted)
            .ToListAsync(cancellationToken);

        var existingCustomerIds = existingVisits.Select(v => v.CustomerId).ToHashSet();

        var customersWithOrders = await GetCustomersWithClosedOrders(routeId, deliveryDate, cancellationToken);
        var newCustomerIds = customersWithOrders
            .Select(c => c.Id)
            .Where(id => !existingCustomerIds.Contains(id))
            .ToList();

        if (newCustomerIds.Count == 0) return;

        var newCustomers = customersWithOrders
            .Where(c => newCustomerIds.Contains(c.Id))
            .OrderBy(c => c.SequenceOrder)
            .ToList();

        int maxSeq = existingVisits.Count > 0 ? existingVisits.Max(v => v.SequenceOrder) : 0;

        var newVisits = newCustomers.Select((c, idx) => new CustomerVisit
        {
            Id = Guid.NewGuid(),
            RouteExecutionId = executionId,
            CustomerId = c.Id,
            SequenceOrder = maxSeq + idx + 1,
            Status = VisitStatus.OrderPlaced,
        });

        await context.CustomerVisits.AddRangeAsync(newVisits, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
    }
}