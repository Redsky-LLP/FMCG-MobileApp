using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Orders.DTOs;

namespace FMCG.Distribution.Application.Features.Orders.Queries;

public class GetCustomerOrderHistoryQuery : IRequest<Result<List<CustomerOrderHistoryDto>>>
{
    public Guid CustomerId { get; set; }
    public Guid? SalesmanId { get; set; }
    public bool IsAdmin { get; set; }
    public int Limit { get; set; } = 10;
}