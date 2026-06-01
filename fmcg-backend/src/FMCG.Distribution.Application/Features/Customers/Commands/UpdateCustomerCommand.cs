using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Customers.Commands;

public class UpdateCustomerCommand : IRequest<Result<UpdateCustomerResponse>>
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Address { get; set; }
    public Guid RouteId { get; set; }
    public int SequenceOrder { get; set; }
    public bool IsActive { get; set; }
}

public class UpdateCustomerResponse
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Address { get; set; }
    public Guid RouteId { get; set; }
    public int SequenceOrder { get; set; }
    public bool IsActive { get; set; }
}