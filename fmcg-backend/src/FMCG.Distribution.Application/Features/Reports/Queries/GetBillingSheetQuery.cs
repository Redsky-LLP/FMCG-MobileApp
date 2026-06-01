using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Reports.DTOs;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetBillingSheetQuery : IRequest<Result<byte[]>>
{
    public Guid? RouteId { get; set; }
    public DateTime? Date { get; set; }
}