// PATH: src/FMCG.Distribution.Application/Features/Orders/DTOs/OrderDto.cs

namespace FMCG.Distribution.Application.Features.Orders.DTOs;

public class OrderDto
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerNameMalayalam { get; set; }
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public Guid SalesmanId { get; set; }           // ← ADD THIS
    public string? SalesmanName { get; set; }      // ← ADD THIS
    public OrderStatus Status { get; set; }
    public DateTime OrderDate { get; set; }
    public int TotalItems { get; set; }
    public int ItemCount { get; set; }             // ← ADD THIS
    public decimal TotalQuantity { get; set; }
    public decimal TotalAmount { get; set; }
    public string? Remarks { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }      // ← ADD THIS
    public DateTime? ClosedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderItemDto>? Items { get; set; }
}