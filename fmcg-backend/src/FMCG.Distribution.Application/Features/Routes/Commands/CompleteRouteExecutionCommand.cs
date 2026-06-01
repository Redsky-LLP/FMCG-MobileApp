using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class CompleteRouteExecutionCommand : IRequest<Result<CompleteRouteExecutionResponse>>
{
    public Guid ExecutionId { get; set; }
    public Guid SalesmanId { get; set; }
}

public class CompleteRouteExecutionResponse
{
    public Guid ExecutionId { get; set; }
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public DateTime ExecutionDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public int TotalCustomers { get; set; }
    public int VisitedCount { get; set; }
    public int OrderCount { get; set; }
    public int SkippedCount { get; set; }
    public int NoOrderCount { get; set; }
}