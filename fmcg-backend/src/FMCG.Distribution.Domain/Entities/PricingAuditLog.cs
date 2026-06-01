using FMCG.Distribution.Domain.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Domain.Entities;

public class PricingAuditLog : BaseEntity
{
    public Guid ProductId { get; set; }
    public decimal OldPrice { get; set; }
    public decimal NewPrice { get; set; }
    public PricingAction Action { get; set; }
    public string? Reason { get; set; }
    public string ModifiedBy { get; set; } = string.Empty;

    // Navigation property
    public virtual Product? Product { get; set; }
}