using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class ProductGroup : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? NameMl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation property
    public virtual ICollection<Product>? Products { get; set; }
}