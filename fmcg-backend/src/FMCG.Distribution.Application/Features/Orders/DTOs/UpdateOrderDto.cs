namespace FMCG.Distribution.Application.Features.Orders.DTOs;

public class UpdateOrderDto
{
    public Guid CustomerId { get; set; }
    public string? Remarks { get; set; }
    public List<UpdateOrderItemDto> Items { get; set; } = [];
}

public class UpdateOrderItemDto
{
    public Guid? Id { get; set; }  // Null for new items, has value for existing
    public Guid ProductId { get; set; }
    public decimal Quantity { get; set; }
    public Guid UnitId { get; set; }
    public decimal SellingPrice { get; set; }

    // ── Per-unit-type quantities (optional) ───────────────────────────────────
    public int? QuantityBags { get; set; }
    public int? QuantityBoxes { get; set; }
    public int? QuantityTins { get; set; }
    // ─────────────────────────────────────────────────────────────────────────
}