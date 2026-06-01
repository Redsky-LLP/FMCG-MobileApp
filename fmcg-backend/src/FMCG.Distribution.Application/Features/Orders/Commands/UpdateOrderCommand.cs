// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/UpdateOrderCommand.cs
// FIXED: Class defined ONLY here. The duplicate definition inside UpdateOrderCommandHandler.cs
//        caused CS0229 "Ambiguity" errors — remove the class block from that file.

using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Orders.DTOs;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class UpdateOrderCommand : IRequest<Result<OrderDetailDto>>
{
    public Guid Id { get; set; }
    public Guid SalesmanId { get; set; }
    public bool IsAdmin { get; set; }
    public Guid CustomerId { get; set; }
    public string? Remarks { get; set; }
    public List<UpdateOrderItemDto> Items { get; set; } = [];
}