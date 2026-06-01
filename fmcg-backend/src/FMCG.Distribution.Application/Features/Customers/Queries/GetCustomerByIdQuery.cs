using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Customers.Queries;

public class GetCustomerByIdQuery : IRequest<Result<CustomerDetailDto>>
{
    public Guid Id { get; set; }
}

public class CustomerDetailDto
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Address { get; set; }
    public Guid RouteId { get; set; }
    public string? RouteName { get; set; }
    public string? RouteDescription { get; set; }
    public int SequenceOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? TotalOrdersCount { get; set; }
}