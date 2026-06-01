using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Customers.Commands;

public class UpdateCustomerCommandHandler : IRequestHandler<UpdateCustomerCommand, Result<UpdateCustomerResponse>>
{
    private readonly IApplicationDbContext _context;

    public UpdateCustomerCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<UpdateCustomerResponse>> Handle(UpdateCustomerCommand request, CancellationToken cancellationToken)
    {
        var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == request.Id && !c.IsDeleted, cancellationToken);

        if (customer == null)
        {
            return Result<UpdateCustomerResponse>.Failure("Customer not found.");
        }

        // Verify route exists if changed
        if (customer.RouteId != request.RouteId)
        {
            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == request.RouteId && !r.IsDeleted, cancellationToken);
            if (route == null)
            {
                return Result<UpdateCustomerResponse>.Failure("Route not found.");
            }
        }

        customer.NameEnglish = request.NameEnglish;
        customer.NameMalayalam = request.NameMalayalam;
        customer.PhoneNumber = request.PhoneNumber;
        customer.Address = request.Address;
        customer.RouteId = request.RouteId;
        customer.SequenceOrder = request.SequenceOrder;
        customer.IsActive = request.IsActive;
        customer.UpdateTimestamp("system");

        await _context.SaveChangesAsync(cancellationToken);

        return Result<UpdateCustomerResponse>.Success(new UpdateCustomerResponse
        {
            Id = customer.Id,
            NameEnglish = customer.NameEnglish,
            NameMalayalam = customer.NameMalayalam,
            PhoneNumber = customer.PhoneNumber,
            Address = customer.Address,
            RouteId = customer.RouteId,
            SequenceOrder = customer.SequenceOrder,
            IsActive = customer.IsActive
        }, "Customer updated successfully.");
    }
}