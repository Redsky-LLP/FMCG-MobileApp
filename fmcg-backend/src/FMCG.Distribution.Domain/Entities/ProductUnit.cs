// PATH: src/FMCG.Distribution.Domain/Entities/ProductUnit.cs
// ADDED: Enhanced unit fields for measurement type, base unit value, and base unit name

using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class ProductUnit : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Symbol { get; set; }
    public string? Abbreviation { get; set; }
    public bool IsActive { get; set; } = true;

    // Loading priority (1 = load first, higher numbers load later)
    public int LoadingPriority { get; set; } = 99;

    // ── NEW: Enhanced unit fields for measurement support ────────────────────
    // Measurement type: "weight", "volume", "count"
    public string? MeasurementType { get; set; }

    // Base unit value: e.g., 50 for "50kg"
    public decimal? BaseUnitValue { get; set; }

    // Base unit name: e.g., "kg" for weight, "L" for volume
    public string? BaseUnitName { get; set; }
    // ─────────────────────────────────────────────────────────────────────────

    // Navigation property
    public virtual ICollection<Product>? Products { get; set; }
}