// PATH: src/FMCG.Distribution.Application/Features/Orders/DTOs/OrderDetailDto.cs

namespace FMCG.Distribution.Application.Features.Orders.DTOs;

public class OrderDetailDto : OrderDto
{
    public List<OrderItemDto> Items { get; set; } = [];
    public DateTime? ApprovedAt { get; set; }      // ← ADD THIS
}