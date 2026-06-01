using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class BasePrice : BaseEntity
{
    public Guid ProductId { get; set; }
    public decimal Price { get; set; }
    public DateTime EffectiveDate { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Reason { get; set; }

    // Navigation property
    public virtual Product? Product { get; set; }
}