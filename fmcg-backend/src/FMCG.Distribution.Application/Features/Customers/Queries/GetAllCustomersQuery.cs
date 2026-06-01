using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Customers.Queries;

public class GetAllCustomersQuery : IRequest<Result<List<CustomerDto>>>
{
    public Guid? RouteId { get; set; }
    public Guid? CurrentUserId { get; set; }
    public bool IsAdmin { get; set; }
    public string? UserRole { get; set; }
}

public class CustomerDto
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Address { get; set; }
    public Guid RouteId { get; set; }
    public string? RouteName { get; set; }
    public int SequenceOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}