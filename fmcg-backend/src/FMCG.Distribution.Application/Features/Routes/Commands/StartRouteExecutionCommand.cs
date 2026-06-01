// PATH: src/FMCG.Distribution.Application/Features/Routes/Commands/StartRouteExecutionCommand.cs

using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class StartRouteExecutionCommand : IRequest<Result<StartRouteExecutionResponse>>
{
    public Guid RouteId { get; set; }
    public Guid SalesmanId { get; set; }

    // ── Date selection ────────────────────────────────────────────────────────
    public DateTime? ExecutionDate { get; set; }
    public bool IsAdmin { get; set; }

    // ── NEW: Mode selection ───────────────────────────────────────────────────
    // true = Order Taking mode (visit ALL customers, create orders as Draft/Submitted)
    // false = Delivery mode (only visit customers with Submitted orders)
    public bool IsOrderTaking { get; set; } = false;
    // ─────────────────────────────────────────────────────────────────────────
}

public class StartRouteExecutionResponse
{
    public Guid ExecutionId { get; set; }
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public DateTime ExecutionDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public int TotalCustomers { get; set; }
    public bool IsOrderTaking { get; set; } = false;
}