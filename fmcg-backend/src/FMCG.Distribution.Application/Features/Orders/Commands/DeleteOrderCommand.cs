using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class DeleteOrderCommand : IRequest<Result<bool>>
{
    public Guid Id { get; set; }
    public Guid SalesmanId { get; set; }
}