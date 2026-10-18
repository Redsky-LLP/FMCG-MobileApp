using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class UpdateRouteCommandHandler : IRequestHandler<UpdateRouteCommand, Result<UpdateRouteResponse>>
{
    private readonly IApplicationDbContext _context;

    public UpdateRouteCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<UpdateRouteResponse>> Handle(UpdateRouteCommand request, CancellationToken cancellationToken)
    {
        var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == request.Id && !r.IsDeleted, cancellationToken);

        if (route == null)
        {
            return Result<UpdateRouteResponse>.Failure("Route not found.");
        }

        route.Name = request.Name;
        route.Description = request.Description;
        route.SequenceOrder = request.SequenceOrder;
        route.AssignedSalesmanId = request.AssignedSalesmanId;
        route.IsActive = request.IsActive;
        // null = not sent → keep the old value; 0 = clear the target; >0 = set it
        if (request.DailyBagTarget.HasValue)
            route.DailyBagTarget = request.DailyBagTarget.Value > 0 ? request.DailyBagTarget : null;
        if (request.MonthlyBagTarget.HasValue)
            route.MonthlyBagTarget = request.MonthlyBagTarget.Value > 0 ? request.MonthlyBagTarget : null;
        route.UpdateTimestamp("system");

        await _context.SaveChangesAsync(cancellationToken);

        return Result<UpdateRouteResponse>.Success(new UpdateRouteResponse
        {
            Id = route.Id,
            Name = route.Name,
            Description = route.Description,
            SequenceOrder = route.SequenceOrder,
            AssignedSalesmanId = route.AssignedSalesmanId,
            DailyBagTarget = route.DailyBagTarget,
            MonthlyBagTarget = route.MonthlyBagTarget,
            IsActive = route.IsActive
        }, "Route updated successfully.");
    }
}