// PATH: src/FMCG.Distribution.Application/Features/Routes/Queries/GetCurrentRouteExecutionQuery.cs
// FIX: IDE0028 — simplified collection initialization

using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetCurrentRouteExecutionQuery : IRequest<Result<CurrentRouteExecutionDto>>
{
    public Guid RouteId { get; set; }
    public Guid SalesmanId { get; set; }
}

public class CurrentRouteExecutionDto
{
    public bool HasActiveExecution { get; set; }
    public Guid? ExecutionId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime ExecutionDate { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public int TotalCustomers { get; set; }
    public int CompletedCount { get; set; }
    public int PendingCount { get; set; }
    public List<CustomerVisitStatusDto> Customers { get; set; } = [];   // IDE0028
}

public class CustomerVisitStatusDto
{
    public Guid VisitId { get; set; }
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerNameMalayalam { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public int SequenceOrder { get; set; }
    public string VisitStatus { get; set; } = string.Empty;
    public Guid? OrderId { get; set; }
    public string? SkipReason { get; set; }
    public bool IsCompleted => VisitStatus != "Pending";
}