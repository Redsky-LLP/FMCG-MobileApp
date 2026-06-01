using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Reports.DTOs;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetDailySummaryReportQuery : IRequest<Result<byte[]>>
{
    public DateTime? Date { get; set; }
}