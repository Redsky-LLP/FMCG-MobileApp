namespace FMCG.Distribution.Application.Features.Orders.DTOs;

public class OrderItemDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductNameMalayalam { get; set; }
    public decimal Quantity { get; set; }
    public Guid UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public string? UnitSymbol { get; set; }
    public decimal SellingPrice { get; set; }
    public decimal BasePriceAtTime { get; set; }
    public decimal Variance => (SellingPrice - BasePriceAtTime) * Quantity;

    // ── Per-unit-type quantities ───────────────────────────────────────────────
    public int? QuantityBags { get; set; }
    public int? QuantityBoxes { get; set; }
    public int? QuantityTins { get; set; }
    // ─────────────────────────────────────────────────────────────────────────
}