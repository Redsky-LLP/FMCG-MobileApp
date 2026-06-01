using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Customers.Queries;

public class GetCustomerByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetCustomerByIdQuery, Result<CustomerDetailDto>>
{
    public async Task<Result<CustomerDetailDto>> Handle(GetCustomerByIdQuery request, CancellationToken cancellationToken)
    {
        var customer = await context.Customers
            .Include(c => c.Route)
            .FirstOrDefaultAsync(c => c.Id == request.Id && !c.IsDeleted, cancellationToken);

        if (customer == null)
        {
            return Result<CustomerDetailDto>.Failure("Customer not found.");
        }

        var dto = new CustomerDetailDto
        {
            Id = customer.Id,
            NameEnglish = customer.NameEnglish,
            NameMalayalam = customer.NameMalayalam,
            PhoneNumber = customer.PhoneNumber ?? string.Empty,
            Address = customer.Address,
            RouteId = customer.RouteId,
            RouteName = customer.Route?.Name,
            RouteDescription = customer.Route?.Description,
            SequenceOrder = customer.SequenceOrder,
            IsActive = customer.IsActive,
            CreatedAt = customer.CreatedAt,
            TotalOrdersCount = 0
        };

        return Result<CustomerDetailDto>.Success(dto);
    }
}