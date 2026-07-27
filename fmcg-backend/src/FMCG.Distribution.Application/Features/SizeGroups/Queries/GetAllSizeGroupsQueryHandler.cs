using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.SizeGroups.Queries;

public class GetAllSizeGroupsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetAllSizeGroupsQuery, Result<List<SizeGroupDto>>>
{
    public async Task<Result<List<SizeGroupDto>>> Handle(GetAllSizeGroupsQuery request, CancellationToken cancellationToken)
    {
        var query = context.SizeGroups
            .AsNoTracking()
            .Where(g => !g.IsDeleted);

        if (request.IsActive.HasValue)
        {
            query = query.Where(g => g.IsActive == request.IsActive.Value);
        }

        var groups = await query
            .OrderBy(g => g.Name)
            .Select(g => new SizeGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                NameMl = g.NameMl,
                Description = g.Description,
                IsActive = g.IsActive,
                ProductCount = context.Products.Count(p => p.SizeGroupId == g.Id && !p.IsDeleted)
            })
            .ToListAsync(cancellationToken);

        return Result<List<SizeGroupDto>>.Success(groups);
    }
}