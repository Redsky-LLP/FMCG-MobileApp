using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class SettlementPayment : BaseEntity
{
    public Guid CustomerId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentMode { get; set; }
    public string? Remarks { get; set; }
    public Guid RecordedByUserId { get; set; }

    // Navigation properties
    public virtual Customer? Customer { get; set; }
    public virtual User? RecordedByUser { get; set; }
}