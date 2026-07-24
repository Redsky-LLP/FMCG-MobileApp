// Domain/Entities/SizeGroup.cs
using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class SizeGroup : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? NameMl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    // ── NEW: controls the order this group is listed in on the Loading Sheet,
    // Billing Sheet, and Size Group Summary. Lower numbers list first. -1 means
    // "not yet assigned" — reports fall back to a sensible heaviest-first guess
    // for any group left at -1. Editable via the Size Groups admin screen (up/down
    // reorder), backed by PUT /api/v1/sizegroups/{id}/priority. ──
    public int SortOrder { get; set; } = -1;

    // Navigation property
    public virtual ICollection<Product>? Products { get; set; }
}