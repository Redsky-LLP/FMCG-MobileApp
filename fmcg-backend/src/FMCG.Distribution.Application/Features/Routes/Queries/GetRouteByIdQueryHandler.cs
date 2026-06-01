using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetRouteByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetRouteByIdQuery, Result<RouteDetailDto>>
{
    public async Task<Result<RouteDetailDto>> Handle(GetRouteByIdQuery request, CancellationToken cancellationToken)
    {
        var route = await context.Routes
            .Include(r => r.AssignedSalesman)
            .Include(r => r.Customers!.Where(c => !c.IsDeleted && c.IsActive))
            .FirstOrDefaultAsync(r => r.Id == request.Id && !r.IsDeleted, cancellationToken);

        if (route == null)
        {
            return Result<RouteDetailDto>.Failure("Route not found.");
        }

        // Authorization: Non-admin users can only view their assigned route
        if (!request.IsAdmin && request.CurrentUserId.HasValue &&
            route.AssignedSalesmanId != request.CurrentUserId.Value)
        {
            return Result<RouteDetailDto>.Failure("You are not authorized to view this route.");
        }

        var dto = new RouteDetailDto
        {
            Id = route.Id,
            Name = route.Name,
            Description = route.Description,
            SequenceOrder = route.SequenceOrder,
            AssignedSalesmanId = route.AssignedSalesmanId,
            AssignedSalesmanName = route.AssignedSalesman?.FullName,
            IsActive = route.IsActive,
            CreatedAt = route.CreatedAt,
            CustomerCount = route.Customers?.Count ?? 0,
            Customers = route.Customers?.OrderBy(c => c.SequenceOrder).Select(c => new CustomerBriefDto
            {
                Id = c.Id,
                NameEnglish = c.NameEnglish,
                NameMalayalam = c.NameMalayalam,
                PhoneNumber = c.PhoneNumber ?? string.Empty,
                Address = c.Address,
                SequenceOrder = c.SequenceOrder,
                IsActive = c.IsActive
            }).ToList() ?? []
        };

        return Result<RouteDetailDto>.Success(dto);
    }
}