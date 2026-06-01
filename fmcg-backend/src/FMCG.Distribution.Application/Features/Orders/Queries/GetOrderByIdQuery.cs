using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Orders.DTOs;

namespace FMCG.Distribution.Application.Features.Orders.Queries;

public class GetOrderByIdQuery : IRequest<Result<OrderDetailDto>>
{
    public Guid Id { get; set; }
    public Guid? SalesmanId { get; set; }
    public bool IsAdmin { get; set; }
}