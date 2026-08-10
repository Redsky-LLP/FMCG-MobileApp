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
    public Guid SalesmanId { get; set; }
    public string? SalesmanName { get; set; }
    public OrderStatus Status { get; set; }
    public DateTime OrderDate { get; set; }
    public int TotalItems { get; set; }
    public int ItemCount { get; set; }
    public decimal TotalQuantity { get; set; }
    public decimal TotalAmount { get; set; }
    public string? Remarks { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExecutionDate { get; set; } // ← ADD THIS
    public Guid? ExecutionId { get; set; } // ← ADD THIS if not exists
    public List<OrderItemDto>? Items { get; set; }
    // Set true the moment admin runs Close Day — now applies to every order,
    // Draft included. This is the single source of truth for "can this be
    // edited anymore," checked server-side on every update and read by the
    // frontend to grey out the edit form before the user even tries.
    public bool IsLocked { get; set; }
}