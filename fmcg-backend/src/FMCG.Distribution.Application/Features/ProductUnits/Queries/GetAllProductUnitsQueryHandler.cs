using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.ProductUnits.Queries;

public class GetAllProductUnitsQuery : IRequest<Result<List<ProductUnitDto>>> { }

public class ProductUnitDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Abbreviation { get; set; }
    public DateTime CreatedDate { get; set; }
}

public class GetAllProductUnitsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetAllProductUnitsQuery, Result<List<ProductUnitDto>>>
{
    public async Task<Result<List<ProductUnitDto>>> Handle(
        GetAllProductUnitsQuery request, CancellationToken cancellationToken)
    {
        var units = await context.ProductUnits
            .Where(u => !u.IsDeleted)
            .OrderBy(u => u.Name)
            .Select(u => new ProductUnitDto
            {
                Id = u.Id,
                Name = u.Name,
                Abbreviation = u.Abbreviation ?? u.Symbol,
                CreatedDate = u.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Result<List<ProductUnitDto>>.Success(units);
    }
}