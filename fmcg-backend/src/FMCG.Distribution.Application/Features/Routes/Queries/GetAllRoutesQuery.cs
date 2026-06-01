using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetAllRoutesQuery : IRequest<Result<List<RouteDto>>>
{
    public Guid? CurrentUserId { get; set; }
    public bool IsAdmin { get; set; }
    public string? UserRole { get; set; }
}

public class RouteDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SequenceOrder { get; set; }
    public Guid? AssignedSalesmanId { get; set; }
    public string? AssignedSalesmanName { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public int CustomerCount { get; set; }

    // For Salesman view - indicates this route is a temporary override for today
    public bool IsTodayOverride { get; set; }
    public string? OverrideNotes { get; set; }

    // For Admin view - indicates if route has any override for today
    public bool HasOverrideToday { get; set; }
}