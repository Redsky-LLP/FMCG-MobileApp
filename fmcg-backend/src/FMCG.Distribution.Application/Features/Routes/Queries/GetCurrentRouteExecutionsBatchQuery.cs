using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// PATH: src/FMCG.Distribution.Application/Features/Routes/Queries/GetCurrentRouteExecutionsBatchQuery.cs
// PERFORMANCE FIX: companion to GetCurrentRouteExecutionQuery, but for MANY routes
// in one call instead of one call per route. SalesmanRoutes.tsx was previously
// calling GetCurrentRouteExecution once PER route a salesman has (3-4 routes is
// typical) — and that handler itself does up to 6 sequential DB round-trips per
// call (fetch execution, possibly auto-start it, fetch customers, possibly
// auto-add missing visits, reload, fetch route name). Even running those calls
// concurrently client-side, each one still pays the full cross-cloud latency
// chain independently, and they compete for the same DB connections. This
// query does the same self-healing logic but with all reads batched into a
// handful of queries total, and at most ONE SaveChanges call, regardless of
// how many routes are being checked.

using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetCurrentRouteExecutionsBatchQuery : IRequest<Result<List<RouteExecutionSummaryDto>>>
{
    public List<Guid> RouteIds { get; set; } = [];
    public Guid SalesmanId { get; set; }
}

// Same shape as CurrentRouteExecutionDto, plus RouteId so the frontend can map
// each result back to the route it belongs to.
public class RouteExecutionSummaryDto
{
    public Guid RouteId { get; set; }
    public bool HasActiveExecution { get; set; }
    public Guid? ExecutionId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime ExecutionDate { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public int TotalCustomers { get; set; }
    public int CompletedCount { get; set; }
    public int PendingCount { get; set; }
    public List<CustomerVisitStatusDto> Customers { get; set; } = [];
}

// Simple request body for the batched controller endpoint (POST, since a list
// of route IDs doesn't fit cleanly into a query string).
public class GetCurrentRouteExecutionsBatchRequest
{
    public List<Guid> RouteIds { get; set; } = [];
}