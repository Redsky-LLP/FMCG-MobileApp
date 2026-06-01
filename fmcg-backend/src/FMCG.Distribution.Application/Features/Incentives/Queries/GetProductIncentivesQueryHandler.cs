using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Incentives.DTOs;

namespace FMCG.Distribution.Application.Features.Incentives.Queries;

public class GetProductIncentivesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetProductIncentivesQuery, Result<List<ProductIncentiveDto>>>
{
    public async Task<Result<List<ProductIncentiveDto>>> Handle(GetProductIncentivesQuery request, CancellationToken cancellationToken)
    {
        var query = context.ProductIncentives
            .Include(i => i.Product)
            .Where(i => !i.IsDeleted);

        if (request.ProductId.HasValue)
        {
            query = query.Where(i => i.ProductId == request.ProductId.Value);
        }

        if (request.IsActive.HasValue)
        {
            query = query.Where(i => i.IsActive == request.IsActive.Value);
        }

        var incentives = await query
            .OrderByDescending(i => i.EffectiveDate)
            .Select(i => new ProductIncentiveDto
            {
                Id = i.Id,
                ProductId = i.ProductId,
                ProductName = i.Product != null ? i.Product.NameEnglish : string.Empty,
                ProductNameMalayalam = i.Product != null ? i.Product.NameMalayalam : null,
                IncentiveValue = i.IncentiveValue,
                IncentiveType = i.IncentiveType.ToString(),
                EffectiveDate = i.EffectiveDate,
                EndDate = i.EndDate,
                IsActive = i.IsActive,
                Description = i.Description,
                CreatedAt = i.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Result<List<ProductIncentiveDto>>.Success(incentives);
    }
}