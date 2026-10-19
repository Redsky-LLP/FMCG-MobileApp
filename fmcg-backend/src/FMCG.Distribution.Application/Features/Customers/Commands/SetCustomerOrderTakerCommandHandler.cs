using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Customers.Commands;

public class SetCustomerOrderTakerCommandHandler(IApplicationDbContext context)
    : IRequestHandler<SetCustomerOrderTakerCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(SetCustomerOrderTakerCommand request, CancellationToken cancellationToken)
    {
        var customer = await context.Customers
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId && !c.IsDeleted, cancellationToken);

        if (customer == null)
            return Result<bool>.Failure("Customer not found.");

        customer.OrderTakenByAdmin = request.OrderTakenByAdmin;
        customer.UpdateTimestamp("system");
        await context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true,
            request.OrderTakenByAdmin
                ? "Admin will take orders for this customer."
                : "Salesman will take orders for this customer.");
    }
}