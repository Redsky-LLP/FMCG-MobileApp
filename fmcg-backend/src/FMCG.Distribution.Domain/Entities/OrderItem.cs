using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class OrderItem : BaseEntity
{
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public decimal Quantity { get; set; }
    public Guid UnitId { get; set; }
    public decimal SellingPrice { get; set; }
    public decimal BasePriceAtTime { get; set; }

    // ── Per-unit-type quantities ──────────────────────────────────────────────
    // All nullable for backward compatibility. When any of these are set,
    // Quantity = QuantityBags + QuantityBoxes + QuantityTins (enforced in handler).
    // Legacy rows where all three are null continue to use Quantity directly.
    public int? QuantityBags { get; set; }
    public int? QuantityBoxes { get; set; }
    public int? QuantityTins { get; set; }
    // ─────────────────────────────────────────────────────────────────────────

    // Calculated property (not stored in database)
    public decimal Variance => (SellingPrice - BasePriceAtTime) * Quantity;

    // Navigation properties
    public virtual Order? Order { get; set; }
    public virtual Product? Product { get; set; }
    public virtual ProductUnit? Unit { get; set; }
}