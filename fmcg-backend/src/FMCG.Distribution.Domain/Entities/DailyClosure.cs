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

    // Navigation property
    public virtual User? ClosedByUser { get; set; }
}