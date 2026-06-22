using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.SizeGroups.Queries;

public class GetAllSizeGroupsQuery : IRequest<Result<List<SizeGroupDto>>>
{
    public bool? IsActive { get; set; }
}

public class SizeGroupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? NameMl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int ProductCount { get; set; }
}