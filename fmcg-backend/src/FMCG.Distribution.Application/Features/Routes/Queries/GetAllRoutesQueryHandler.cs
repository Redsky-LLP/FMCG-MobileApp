using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetAllRoutesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetAllRoutesQuery, Result<List<RouteDto>>>
{
    public async Task<Result<List<RouteDto>>> Handle(GetAllRoutesQuery request, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;

        // For Salesman role
        if (!request.IsAdmin && request.UserRole == "Salesman" && request.CurrentUserId.HasValue)
        {
            var salesmanId = request.CurrentUserId.Value;

            // Get daily overrides for TODAY where this salesman is assigned
            var todayOverrides = await context.RouteAssignments
                .Where(a => !a.IsDeleted
                    && a.SalesmanId == salesmanId
                    && a.AssignmentDate.Date == today)
                .Select(a => new { a.RouteId, a.Notes })
                .ToListAsync(cancellationToken);

            var overrideRouteIds = todayOverrides.Select(o => o.RouteId).ToHashSet();
            var overrideNotes = todayOverrides.ToDictionary(o => o.RouteId, o => o.Notes);

            // Get permanent routes assigned to this salesman
            var permanentRoutes = await context.Routes
                .Include(r => r.AssignedSalesman)
                .Include(r => r.Customers)
                .Where(r => !r.IsDeleted && r.IsActive && r.AssignedSalesmanId == salesmanId)
                .ToListAsync(cancellationToken);

            // Get routes where this salesman is the daily override (NOT in permanent)
            var overrideRoutes = await context.Routes
                .Include(r => r.AssignedSalesman)
                .Include(r => r.Customers)
                .Where(r => !r.IsDeleted
                    && r.IsActive
                    && overrideRouteIds.Contains(r.Id)
                    && r.AssignedSalesmanId != salesmanId)
                .ToListAsync(cancellationToken);

            // Combine all routes
            var allRoutes = permanentRoutes
                .Concat(overrideRoutes)
                .DistinctBy(r => r.Id)
                .ToList();

            // Build result with IsTodayOverride flag
            var result = allRoutes.Select(r => new RouteDto
            {
                Id = r.Id,
                Name = r.Name,
                Description = r.Description,
                SequenceOrder = r.SequenceOrder,
                AssignedSalesmanId = r.AssignedSalesmanId,
                AssignedSalesmanName = r.AssignedSalesman?.FullName,
                IsActive = r.IsActive,
                CreatedAt = r.CreatedAt,
                CustomerCount = r.Customers?.Count(c => !c.IsDeleted && c.IsActive) ?? 0,
                IsTodayOverride = overrideRouteIds.Contains(r.Id),
                OverrideNotes = overrideRouteIds.Contains(r.Id) ? overrideNotes.GetValueOrDefault(r.Id) : null
            }).ToList();

            return Result<List<RouteDto>>.Success(result);
        }

        // For Admin, return all routes with override info
        var adminRoutes = await context.Routes
            .Include(r => r.AssignedSalesman)
            .Include(r => r.Customers)
            .Where(r => !r.IsDeleted)
            .OrderBy(r => r.SequenceOrder)
            .Select(r => new RouteDto
            {
                Id = r.Id,
                Name = r.Name,
                Description = r.Description,
                SequenceOrder = r.SequenceOrder,
                AssignedSalesmanId = r.AssignedSalesmanId,
                AssignedSalesmanName = r.AssignedSalesman != null ? r.AssignedSalesman.FullName : null,
                IsActive = r.IsActive,
                CreatedAt = r.CreatedAt,
                CustomerCount = r.Customers != null ? r.Customers.Count(c => !c.IsDeleted && c.IsActive) : 0,
                HasOverrideToday = context.RouteAssignments
                    .Any(a => a.RouteId == r.Id && a.AssignmentDate.Date == today && !a.IsDeleted)
            })
            .ToListAsync(cancellationToken);

        return Result<List<RouteDto>>.Success(adminRoutes);
    }
}