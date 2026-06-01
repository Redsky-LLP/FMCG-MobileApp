// PATH: src/FMCG.Distribution.Domain/Entities/Order.cs

using FMCG.Distribution.Domain.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Domain.Entities;

public class Order : BaseEntity
{
    public string OrderNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Guid RouteId { get; set; }
    public Guid SalesmanId { get; set; }
    public DateTime OrderDate { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Draft;
    public string? Remarks { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }          // ← ADD THIS
    public Guid? ApprovedBy { get; set; }              // ← ADD THIS
    public DateTime? ClosedAt { get; set; }
    public string? ModifiedBy { get; set; }
    public DateTime? ModifiedAt { get; set; }
    public bool IsLocked { get; set; } = false;

    // ── Warehouse packing ─────────────────────────────────────────────────────
    public PackingStatus PackingStatus { get; set; } = PackingStatus.Pending;
    public DateTime? PackedAt { get; set; }
    public Guid? PackedByUserId { get; set; }
    // ─────────────────────────────────────────────────────────────────────────
    public SettlementStatus SettlementStatus { get; set; } = SettlementStatus.Pending;
    public decimal? ExpectedPaymentAmount { get; set; }
    public Guid? CustomerVisitId { get; set; }

    // Navigation properties
    public virtual Customer? Customer { get; set; }
    public virtual Route? Route { get; set; }
    public virtual User? Salesman { get; set; }
    public virtual ICollection<OrderItem>? Items { get; set; }
    public virtual CustomerVisit? CustomerVisit { get; set; }

    public void Submit()
    {
        if (Status != OrderStatus.Draft)
            throw new InvalidOperationException($"Cannot submit order in '{Status}' status. Only Draft orders can be submitted.");

        Status = OrderStatus.PendingApproval;  // ← Changed to PendingApproval
        SubmittedAt = DateTime.UtcNow;
        UpdateTimestamp("system");
    }

    public void Approve()
    {
        if (Status != OrderStatus.PendingApproval)
            throw new InvalidOperationException($"Cannot approve order in '{Status}' status. Only PendingApproval orders can be approved.");

        Status = OrderStatus.Approved;
        ApprovedAt = DateTime.UtcNow;
        UpdateTimestamp("system");
    }

    public void Close()
    {
        if (Status != OrderStatus.Approved && Status != OrderStatus.Packed)
            throw new InvalidOperationException($"Cannot close order in '{Status}' status. Only Approved or Packed orders can be closed.");

        Status = OrderStatus.Closed;
        ClosedAt = DateTime.UtcNow;
        UpdateTimestamp("system");
    }

    public void MarkModified(string modifiedBy)
    {
        ModifiedBy = modifiedBy;
        ModifiedAt = DateTime.UtcNow;
        UpdateTimestamp(modifiedBy);
    }
}