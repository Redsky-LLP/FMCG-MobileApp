// PATH: src/FMCG.Distribution.Domain/Entities/DailyClosure.cs
using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class DailyClosure : BaseEntity
{
    public DateTime ClosureDate { get; set; }
    public DateTime ClosedAt { get; set; }
    public Guid ClosedByUserId { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalOutstanding { get; set; }
    public decimal ExpectedCash { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }

    // ── NEW: closures are now per-route, not per-day-for-everyone ──────────
    // Chengannur closing does not touch Mavelikkara's orders/execution.
    // RouteId is the source of truth for "which route was this closure for";
    // RouteName is denormalized purely so history/report screens don't need
    // an extra join once a route gets renamed or deleted later.
    public Guid RouteId { get; set; }
    public string? RouteName { get; set; }
    // ─────────────────────────────────────────────────────────────────────

    // Navigation property
    public virtual User? ClosedByUser { get; set; }
}