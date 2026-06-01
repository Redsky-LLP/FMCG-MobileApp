using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Features.Customers.Commands;

public class CreateCustomerCommandHandler : IRequestHandler<CreateCustomerCommand, Result<CreateCustomerResponse>>
{
    private readonly IApplicationDbContext _context;

    public CreateCustomerCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CreateCustomerResponse>> Handle(CreateCustomerCommand request, CancellationToken cancellationToken)
    {
        // Verify route exists
        var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == request.RouteId && !r.IsDeleted, cancellationToken);
        if (route == null)
        {
            return Result<CreateCustomerResponse>.Failure("Route not found.");
        }

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            NameEnglish = request.NameEnglish,
            NameMalayalam = request.NameMalayalam,
            PhoneNumber = request.PhoneNumber,
            Address = request.Address,
            RouteId = request.RouteId,
            SequenceOrder = 0,  // ← Default value, admin will update later
            IsActive = true
        };

        await _context.Customers.AddAsync(customer, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<CreateCustomerResponse>.Success(new CreateCustomerResponse
        {
            Id = customer.Id,
            NameEnglish = customer.NameEnglish,
            NameMalayalam = customer.NameMalayalam,
            PhoneNumber = customer.PhoneNumber,
            Address = customer.Address,
            RouteId = customer.RouteId,
            SequenceOrder = customer.SequenceOrder,
            IsActive = customer.IsActive
        }, "Customer created successfully.");
    }
}