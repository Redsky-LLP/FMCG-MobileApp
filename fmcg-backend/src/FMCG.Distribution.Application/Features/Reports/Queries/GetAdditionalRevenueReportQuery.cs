using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetAdditionalRevenueReportQuery : IRequest<Result<byte[]>>
{
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}