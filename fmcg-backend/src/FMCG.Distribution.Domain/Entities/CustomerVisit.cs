using FMCG.Distribution.Domain.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Domain.Entities;

public class CustomerVisit : BaseEntity
{
    public Guid RouteExecutionId { get; set; }
    public Guid CustomerId { get; set; }
    public int SequenceOrder { get; set; }
    public VisitStatus Status { get; set; } = VisitStatus.Pending;
    public Guid? OrderId { get; set; }
    public DateTime? VisitedAt { get; set; }
    public string? SkipReason { get; set; }

    // Navigation properties
    public virtual RouteExecution? RouteExecution { get; set; }
    public virtual Customer? Customer { get; set; }
    public virtual Order? Order { get; set; }

    // Business methods
    public void RecordOrder(Guid orderId)
    {
        Status = VisitStatus.OrderPlaced;
        OrderId = orderId;
        VisitedAt = DateTime.UtcNow;
        UpdateTimestamp(RouteExecution?.SalesmanId.ToString() ?? "system");
    }

    public void RecordSkip(string? reason = null)
    {
        Status = VisitStatus.Skipped;
        SkipReason = reason;
        VisitedAt = DateTime.UtcNow;
        UpdateTimestamp(RouteExecution?.SalesmanId.ToString() ?? "system");
    }

    public void RecordNoOrder()
    {
        Status = VisitStatus.NoOrder;
        VisitedAt = DateTime.UtcNow;
        UpdateTimestamp(RouteExecution?.SalesmanId.ToString() ?? "system");
    }
}