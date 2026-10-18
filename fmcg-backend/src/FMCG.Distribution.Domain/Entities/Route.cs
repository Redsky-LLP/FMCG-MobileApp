using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class Route : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SequenceOrder { get; set; }
    public Guid? AssignedSalesmanId { get; set; }
    public bool IsActive { get; set; } = true;
    public int? DailyBagTarget { get; set; }       // ← ADD
    public int? MonthlyBagTarget { get; set; }     // ← ADD

    // Navigation properties
    public virtual User? AssignedSalesman { get; set; }
    public virtual ICollection<Customer>? Customers { get; set; }
}