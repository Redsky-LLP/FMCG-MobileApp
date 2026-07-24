// PATH: src/FMCG.Distribution.Domain/Entities/OrderItem.cs
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

    // ── NEW: name/size-group snapshot, mirroring how BasePriceAtTime already works —
    // captured ONCE when this OrderItem row is first created (new order, or a new
    // item added to an existing order) and never touched again afterwards, including
    // through edits, reopen, or re-close. This is what keeps historical Billing Sheet /
    // Loading Sheet reports showing the name that was actually on the order at the time,
    // even if someone later renames the product or moves it to a different size group.
    // Nullable for backward compatibility — rows created before this field existed have
    // no snapshot, so reports fall back to a live join to Products/SizeGroup for those. ──
    public string? ProductNameAtTime { get; set; }
    public string? ProductNameMalayalamAtTime { get; set; }
    public string? SizeGroupNameAtTime { get; set; }

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