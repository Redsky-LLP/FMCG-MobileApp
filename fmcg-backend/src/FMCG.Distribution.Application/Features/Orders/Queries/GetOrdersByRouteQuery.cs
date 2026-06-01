using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Orders.DTOs;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Orders.Queries;

public class GetOrdersByRouteQuery : IRequest<Result<List<OrderDto>>>
{
    public Guid RouteId { get; set; }
    public Guid? SalesmanId { get; set; }
    public OrderStatus? Status { get; set; }
}