// ApproveOrderCommand.cs - Should be clean and simple
using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Orders.DTOs;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class ApproveOrderCommand : IRequest<Result<OrderDetailDto>>
{
    public Guid Id { get; set; }
    public Guid AdminId { get; set; }
}