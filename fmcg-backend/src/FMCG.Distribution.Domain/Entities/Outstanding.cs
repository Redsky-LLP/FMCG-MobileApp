using FMCG.Distribution.Domain.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Domain.Entities;

public class Outstanding : BaseEntity
{
    public Guid CustomerId { get; set; }
    public Guid? OrderId { get; set; }
    public decimal OutstandingAmount { get; set; }
    public SettlementStatus SettlementStatus { get; set; } = SettlementStatus.Pending;
    public DateTime? SettledAt { get; set; }
    public string? SettlementReference { get; set; }
    public string? Remarks { get; set; }

    // Navigation properties
    public virtual Customer? Customer { get; set; }
    public virtual Order? Order { get; set; }
}