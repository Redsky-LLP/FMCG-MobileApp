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

        var closure = await context.DailyClosures
            .Include(c => c.ClosedByUser)
            .FirstOrDefaultAsync(c => !c.IsDeleted && c.ClosureDate.Date == targetDate.Date, cancellationToken);

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