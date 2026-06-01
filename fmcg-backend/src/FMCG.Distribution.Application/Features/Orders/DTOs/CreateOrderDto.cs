namespace FMCG.Distribution.Application.Features.Orders.DTOs;

public class CreateOrderDto
{
    public Guid CustomerId { get; set; }
    public string? Remarks { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = [];
}

public class CreateOrderItemDto
{
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