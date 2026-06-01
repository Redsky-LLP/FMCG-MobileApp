// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/SubmitOrderCommand.cs
// Clean single definition — the handler is in SubmitOrderCommandHandler.cs

using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Orders.DTOs;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class SubmitOrderCommand : IRequest<Result<OrderDetailDto>>
{
    public Guid Id { get; set; }
    public Guid SalesmanId { get; set; }
}