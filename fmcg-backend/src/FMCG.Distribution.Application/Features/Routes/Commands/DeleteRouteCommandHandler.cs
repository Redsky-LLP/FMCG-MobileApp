using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class DeleteRouteCommandHandler : IRequestHandler<DeleteRouteCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public DeleteRouteCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<bool>> Handle(DeleteRouteCommand request, CancellationToken cancellationToken)
    {
        var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == request.Id && !r.IsDeleted, cancellationToken);

        if (route == null)
        {
            return Result<bool>.Failure("Route not found.");
        }

        // Check if route has customers
        var hasCustomers = await _context.Customers.AnyAsync(c => c.RouteId == request.Id && !c.IsDeleted, cancellationToken);
        if (hasCustomers)
        {
            return Result<bool>.Failure("Cannot delete route with assigned customers. Deactivate instead.");
        }

        route.SoftDelete("system");
        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Route deleted successfully.");
    }
}