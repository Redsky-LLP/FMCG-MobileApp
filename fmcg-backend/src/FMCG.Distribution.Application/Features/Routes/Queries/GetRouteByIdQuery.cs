using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Queries;

public class GetRouteByIdQuery : IRequest<Result<RouteDetailDto>>
{
    public Guid Id { get; set; }
    public Guid? CurrentUserId { get; set; }
    public bool IsAdmin { get; set; }
}

public class RouteDetailDto : RouteDto
{
    public List<CustomerBriefDto> Customers { get; set; } = [];
}

public class CustomerBriefDto
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Address { get; set; }
    public int SequenceOrder { get; set; }
    public bool IsActive { get; set; }
}