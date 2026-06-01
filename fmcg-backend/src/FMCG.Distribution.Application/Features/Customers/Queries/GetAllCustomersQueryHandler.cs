using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Customers.Queries;

public class GetAllCustomersQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetAllCustomersQuery, Result<List<CustomerDto>>>
{
    public async Task<Result<List<CustomerDto>>> Handle(GetAllCustomersQuery request, CancellationToken cancellationToken)
    {
        var query = context.Customers
            .Include(c => c.Route)
            .Where(c => !c.IsDeleted && c.IsActive);

        // ── FIX: Always respect RouteId if provided ──────────────────────────
        if (request.RouteId.HasValue)
        {
            query = query.Where(c => c.RouteId == request.RouteId.Value);
        }
        // Only fallback to assigned route if no RouteId specified AND user is Salesman
        else if (!request.IsAdmin && request.UserRole == "Salesman" && request.CurrentUserId.HasValue)
        {
            var assignedRoute = await context.Routes
                .FirstOrDefaultAsync(r => r.AssignedSalesmanId == request.CurrentUserId.Value && !r.IsDeleted, cancellationToken);

            if (assignedRoute != null)
            {
                query = query.Where(c => c.RouteId == assignedRoute.Id);
            }
            else
            {
                return Result<List<CustomerDto>>.Success(new List<CustomerDto>());
            }
        }

        var customers = await query
            .OrderBy(c => c.SequenceOrder)
            .Select(c => new CustomerDto
            {
                Id = c.Id,
                NameEnglish = c.NameEnglish,
                NameMalayalam = c.NameMalayalam,
                PhoneNumber = c.PhoneNumber ?? string.Empty,
                Address = c.Address,
                RouteId = c.RouteId,
                RouteName = c.Route != null ? c.Route.Name : null,
                SequenceOrder = c.SequenceOrder,
                IsActive = c.IsActive,
                CreatedAt = c.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Result<List<CustomerDto>>.Success(customers);
    }
}