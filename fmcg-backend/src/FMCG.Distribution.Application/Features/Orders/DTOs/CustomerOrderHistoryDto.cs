namespace FMCG.Distribution.Application.Features.Orders.DTOs;

public class CustomerOrderHistoryDto
{
    public Guid OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }           // ← ADD
    public List<OrderHistoryItemDto> Items { get; set; } = [];
}

public class OrderHistoryItemDto
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductNameMalayalam { get; set; }
    public decimal Quantity { get; set; }
    public string UnitSymbol { get; set; } = string.Empty;

    // ── Added for previous-order display and autofill ─────────────────────────
    public decimal SellingPrice { get; set; }
    public int? QuantityBags { get; set; }
    public int? QuantityBoxes { get; set; }
    public int? QuantityTins { get; set; }
    // ─────────────────────────────────────────────────────────────────────────
}