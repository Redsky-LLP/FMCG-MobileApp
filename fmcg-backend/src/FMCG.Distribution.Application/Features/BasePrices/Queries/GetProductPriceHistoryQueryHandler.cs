using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.BasePrices.Queries;

public class GetProductPriceHistoryQueryHandler : IRequestHandler<GetProductPriceHistoryQuery, Result<List<ProductPriceHistoryDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetProductPriceHistoryQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<ProductPriceHistoryDto>>> Handle(GetProductPriceHistoryQuery request, CancellationToken cancellationToken)
    {
        // Verify product exists
        var product = await _context.Products
            .FirstOrDefaultAsync(p => p.Id == request.ProductId && !p.IsDeleted, cancellationToken);

        if (product == null)
        {
            return Result<List<ProductPriceHistoryDto>>.Failure("Product not found.");
        }

        var history = await _context.BasePrices
            .Where(bp => bp.ProductId == request.ProductId && !bp.IsDeleted)
            .OrderByDescending(bp => bp.EffectiveDate)
            .ToListAsync(cancellationToken);

        var result = new List<ProductPriceHistoryDto>();
        decimal? previousPrice = null;

        for (int i = 0; i < history.Count; i++)
        {
            var bp = history[i];
            result.Add(new ProductPriceHistoryDto
            {
                Id = bp.Id,
                Price = bp.Price,
                PreviousPrice = previousPrice,
                EffectiveDate = bp.EffectiveDate,
                IsActive = bp.IsActive,
                Reason = bp.Reason,
                CreatedAt = bp.CreatedAt
            });
            previousPrice = bp.Price;
        }

        return Result<List<ProductPriceHistoryDto>>.Success(result);
    }
}