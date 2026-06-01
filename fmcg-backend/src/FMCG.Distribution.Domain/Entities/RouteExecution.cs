// PATH: src/FMCG.Distribution.Domain/Entities/RouteExecution.cs
// ADD ExecutionType property

using FMCG.Distribution.Domain.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Domain.Entities;

public class RouteExecution : BaseEntity
{
    public Guid RouteId { get; set; }
    public Guid SalesmanId { get; set; }
    public DateTime ExecutionDate { get; set; }
    public ExecutionStatus Status { get; set; } = ExecutionStatus.Draft;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    // ── NEW: Distinguish between Order Taking and Delivery ────────────────────
    public ExecutionType ExecutionType { get; set; } = ExecutionType.Delivery;
    // ─────────────────────────────────────────────────────────────────────────

    // Navigation properties
    public virtual Route? Route { get; set; }
    public virtual User? Salesman { get; set; }
    public virtual ICollection<CustomerVisit>? Visits { get; set; }

    // Business methods
    public void Start()
    {
        if (Status != ExecutionStatus.Draft)
            throw new InvalidOperationException($"Cannot start execution in '{Status}' status.");

        Status = ExecutionStatus.InProgress;
        StartedAt = DateTime.UtcNow;
        UpdateTimestamp(SalesmanId.ToString());
    }

    public void Complete()
    {
        if (Status != ExecutionStatus.InProgress)
            throw new InvalidOperationException($"Cannot complete execution in '{Status}' status.");

        Status = ExecutionStatus.Completed;
        CompletedAt = DateTime.UtcNow;
        UpdateTimestamp(SalesmanId.ToString());
    }

    public void Abandon()
    {
        if (Status != ExecutionStatus.InProgress)
            throw new InvalidOperationException($"Cannot abandon execution in '{Status}' status.");

        Status = ExecutionStatus.Abandoned;
        CompletedAt = DateTime.UtcNow;
        UpdateTimestamp(SalesmanId.ToString());
    }
}