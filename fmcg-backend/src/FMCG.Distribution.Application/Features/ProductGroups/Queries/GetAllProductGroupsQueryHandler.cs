using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.ProductGroups.Queries;

public class GetAllProductGroupsQuery : IRequest<Result<List<ProductGroupDto>>> { }

public class ProductGroupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? NameMl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int? ProductCount { get; set; }
    public DateTime CreatedDate { get; set; }
}

public class GetAllProductGroupsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetAllProductGroupsQuery, Result<List<ProductGroupDto>>>
{
    public async Task<Result<List<ProductGroupDto>>> Handle(
        GetAllProductGroupsQuery request, CancellationToken cancellationToken)
    {
        var groups = await context.ProductGroups
            .Include(g => g.Products)
            .Where(g => !g.IsDeleted)
            .OrderBy(g => g.Name)
            .Select(g => new ProductGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                NameMl = g.NameMl,
                Description = g.Description,
                IsActive = g.IsActive,
                ProductCount = g.Products != null ? g.Products.Count(p => !p.IsDeleted) : 0,
                CreatedDate = g.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Result<List<ProductGroupDto>>.Success(groups);
    }
}