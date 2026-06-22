// PATH: src/FMCG.Distribution.Domain/Entities/ProductUnit.cs
// UPDATED: Added UQC (Unit Quantity Code) field

using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class ProductUnit : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Symbol { get; set; }
    public string? Abbreviation { get; set; }

    // ── NEW: UQC (Unit Quantity Code) for GST compliance ──
    // Standard codes: BAG, BOX, CTN, PCS, KGS, LTR, MTR, etc.
    public string? UQC { get; set; }

    public bool IsActive { get; set; } = true;

    // Loading priority (1 = load first, higher numbers load later)
    public int LoadingPriority { get; set; } = 99;

    // ── Enhanced unit fields for measurement support ──
    public string? MeasurementType { get; set; }
    public decimal? BaseUnitValue { get; set; }
    public string? BaseUnitName { get; set; }

    // Navigation property
    public virtual ICollection<Product>? Products { get; set; }
}