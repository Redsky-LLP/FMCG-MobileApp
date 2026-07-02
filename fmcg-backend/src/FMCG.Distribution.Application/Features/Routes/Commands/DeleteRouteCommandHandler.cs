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
        // ── FIX: Allow deletion even if route has customers ──
        // Instead of blocking, delete all customers associated with this route
        var customers = await _context.Customers
            .Where(c => c.RouteId == request.Id && !c.IsDeleted)
            .ToListAsync(cancellationToken);

        foreach (var customer in customers)
        {
            customer.SoftDelete("system");  // Soft delete each customer
        }

        route.SoftDelete("system");
        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Route deleted successfully.");
    }
}