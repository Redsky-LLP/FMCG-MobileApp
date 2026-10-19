using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Customers.Commands;

public class SetCustomerOrderTakerCommand : IRequest<Result<bool>>
{
    public Guid CustomerId { get; set; }
    public bool OrderTakenByAdmin { get; set; }
}