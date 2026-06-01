using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Reports.DTOs;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetRouteSummaryReportQuery : IRequest<Result<byte[]>>
{
    public Guid? RouteId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}