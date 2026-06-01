using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class UpdateRouteCommand : IRequest<Result<UpdateRouteResponse>>
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SequenceOrder { get; set; }
    public Guid? AssignedSalesmanId { get; set; }
    public bool IsActive { get; set; }
}

public class UpdateRouteResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SequenceOrder { get; set; }
    public Guid? AssignedSalesmanId { get; set; }
    public bool IsActive { get; set; }
}