using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class Product : BaseEntity
{
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public string? Sku { get; set; }

    // New fields from client requirements
    public string? ItemCode { get; set; }         // COD5, D20 etc.
    public string? HSNCode { get; set; }          // 02K8103, 0302416
    public string? Supplier { get; set; }         // Supplier code/name

    public Guid ProductGroupId { get; set; }
    public Guid DefaultUnitId { get; set; }       // Default selling unit

    // Base price (kept for backward compatibility)
    public decimal BasePrice { get; set; }

    // Stock management
    public decimal ClosingStock { get; set; }     // Current inventory
    public decimal? MinOrderQty { get; set; }     // Minimum quantity per order
    public decimal? MaxOrderQty { get; set; }     // Maximum quantity per order

    public bool IsActive { get; set; } = true;

    // Navigation properties
    public virtual ProductGroup? ProductGroup { get; set; }
    public virtual ProductUnit? DefaultUnit { get; set; }
    public virtual ICollection<ProductUnitPrice>? UnitPrices { get; set; }
}