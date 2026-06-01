using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Features.Settlement.Queries;

public class GetOutstandingByCustomerQuery : IRequest<Result<OutstandingSummaryDto>>
{
    public Guid? CustomerId { get; set; }
    public Guid? RouteId { get; set; }
}