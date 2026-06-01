using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.ProductGroups.Commands;

public class CreateProductGroupCommand : IRequest<Result<CreateProductGroupResponse>>
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class CreateProductGroupResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}