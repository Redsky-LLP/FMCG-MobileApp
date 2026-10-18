using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class CreateRouteCommand : IRequest<Result<CreateRouteResponse>>
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SequenceOrder { get; set; }
    public Guid? AssignedSalesmanId { get; set; }
    public int? DailyBagTarget { get; set; }
    public int? MonthlyBagTarget { get; set; }
}

public class CreateRouteResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SequenceOrder { get; set; }
    public Guid? AssignedSalesmanId { get; set; }
    public bool IsActive { get; set; }
    public int? DailyBagTarget { get; set; }
    public int? MonthlyBagTarget { get; set; }
}