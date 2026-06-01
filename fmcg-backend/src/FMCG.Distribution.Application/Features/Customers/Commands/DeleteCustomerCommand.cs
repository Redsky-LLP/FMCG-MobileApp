using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Customers.Commands;

public class DeleteCustomerCommand : IRequest<Result<bool>>
{
    public Guid Id { get; set; }
}