using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Orders.DTOs;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class CreateOrderCommand : IRequest<Result<OrderDetailDto>>
{
    public Guid SalesmanId { get; set; }
    public Guid CustomerId { get; set; }
    public string? Remarks { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = [];

    // NEW: Link to route execution and visit
    public Guid? ExecutionId { get; set; }
    public Guid? CustomerVisitId { get; set; }
}