// PATH: src/FMCG.Distribution.Domain/Entities/Product.cs
// UPDATED: Added SizeGroupId

using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class Product : BaseEntity
{
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public string? Sku { get; set; }

    // New fields from client requirements
    public string? ItemCode { get; set; }
    public string? HSNCode { get; set; }
    public string? Supplier { get; set; }

    public Guid ProductGroupId { get; set; }
    public Guid DefaultUnitId { get; set; }

    // ── NEW: Size Group ──
    public Guid? SizeGroupId { get; set; }

    // Base price
    public decimal BasePrice { get; set; }

    // Stock management
    public decimal ClosingStock { get; set; }
    public decimal? MinOrderQty { get; set; }
    public decimal? MaxOrderQty { get; set; }
    // ── NEW FIELDS ──
    public decimal? UnitSize { get; set; }    // ← ADD THIS
    public decimal? Incentive { get; set; }   // ← ADD THIS


    public bool IsActive { get; set; } = true;

    // Navigation properties
    public virtual ProductGroup? ProductGroup { get; set; }
    public virtual ProductUnit? DefaultUnit { get; set; }
    public virtual SizeGroup? SizeGroup { get; set; }
    public virtual ICollection<ProductUnitPrice>? UnitPrices { get; set; }
}