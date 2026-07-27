// PATH: src/FMCG.Distribution.Application/Features/Settlement/Queries/GetDailyClosureStatusQueryHandler.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Features.Settlement.Queries;

public class GetDailyClosureStatusQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetDailyClosureStatusQuery, Result<DailyClosureStatusDto>>
{
    public async Task<Result<DailyClosureStatusDto>> Handle(GetDailyClosureStatusQuery request, CancellationToken cancellationToken)
    {
        var targetDate = request.Date ?? DateTime.UtcNow.Date;

        // ── BUG FIX: was missing `c.IsActive` — after ReopenRouteAsync sets
        // IsActive = false on the old closure, this query still matched it
        // (only IsDeleted was checked), so the route looked permanently
        // closed even after a successful reopen. ──
        var closure = await context.DailyClosures
            .AsNoTracking()
            .Include(c => c.ClosedByUser)
            .Where(c => !c.IsDeleted && c.IsActive && c.ClosureDate.Date == targetDate.Date)
            .Where(c => request.RouteId == null || c.RouteId == request.RouteId)
            .FirstOrDefaultAsync(cancellationToken);

        if (closure == null)
        {
            return Result<DailyClosureStatusDto>.Success(new DailyClosureStatusDto
            {
                IsClosed = false
            });
        }

        return Result<DailyClosureStatusDto>.Success(new DailyClosureStatusDto
        {
            IsClosed = true,
            ClosedAt = closure.ClosedAt,
            ClosedByUserId = closure.ClosedByUserId,
            ClosedByUserName = closure.ClosedByUser?.FullName,
            TotalSales = closure.TotalSales,
            TotalOutstanding = closure.TotalOutstanding,
            ExpectedCash = closure.ExpectedCash,
            Notes = closure.Notes
        });
    }
}