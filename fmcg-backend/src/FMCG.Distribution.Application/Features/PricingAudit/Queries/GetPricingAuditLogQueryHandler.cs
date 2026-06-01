using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.PricingAudit.Queries;

public class GetPricingAuditLogQueryHandler : IRequestHandler<GetPricingAuditLogQuery, Result<List<PricingAuditLogDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetPricingAuditLogQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<PricingAuditLogDto>>> Handle(GetPricingAuditLogQuery request, CancellationToken cancellationToken)
    {
        var query = _context.PricingAuditLogs
            .Include(p => p.Product)
            .Where(p => !p.IsDeleted);

        // Apply filters
        if (request.ProductId.HasValue)
        {
            query = query.Where(p => p.ProductId == request.ProductId.Value);
        }

        if (request.Action.HasValue)
        {
            query = query.Where(p => p.Action == request.Action.Value);
        }

        if (request.FromDate.HasValue)
        {
            query = query.Where(p => p.CreatedAt >= request.FromDate.Value);
        }

        if (request.ToDate.HasValue)
        {
            query = query.Where(p => p.CreatedAt <= request.ToDate.Value);
        }

        // Order by most recent first
        query = query.OrderByDescending(p => p.CreatedAt);

        // Apply limit
        if (request.Limit.HasValue && request.Limit.Value > 0)
        {
            query = query.Take(request.Limit.Value);
        }

        var auditLogs = await query
            .Select(p => new PricingAuditLogDto
            {
                Id = p.Id,
                ProductId = p.ProductId,
                ProductName = p.Product != null ? p.Product.NameEnglish : string.Empty,
                OldPrice = p.OldPrice,
                NewPrice = p.NewPrice,
                Action = p.Action.ToString(),
                Reason = p.Reason,
                ModifiedBy = p.ModifiedBy,
                ModifiedAt = p.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Result<List<PricingAuditLogDto>>.Success(auditLogs);
    }
}