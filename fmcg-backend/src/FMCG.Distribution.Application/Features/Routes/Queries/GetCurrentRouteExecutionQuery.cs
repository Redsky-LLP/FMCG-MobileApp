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

    // ── NEW: real-time bag-loading breakdown for this route/day, computed
    // server-side from closed/locked orders — see BagsBreakdownDto below. ──
    public BagsBreakdownDto BagsBreakdown { get; set; } = new();
}

// ── NEW: physical bag counts (by weight) plus the weighted 50kg-equivalent
// total used for the loading-limit alert/display. 50kg bags count fully;
// 30kg and 26kg bags count as 0.5 each toward the equivalent total.
// Remaining/percent-to-next-threshold are computed in the frontend from
// TotalEquivalentBags and Threshold — simple arithmetic, no need to
// duplicate it here. ──
public class BagsBreakdownDto
{
    public int Count50Kg { get; set; }
    public int Count30Kg { get; set; }
    public int Count26Kg { get; set; }
    public decimal TotalEquivalentBags { get; set; }
    public int Threshold { get; set; } = 130;
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