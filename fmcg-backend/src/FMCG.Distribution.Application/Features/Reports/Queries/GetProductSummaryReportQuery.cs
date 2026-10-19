using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetSummaryReportQuery : IRequest<Result<byte[]>>
{
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }

    // NEW: null/empty = default summary (Item Group + Size Group)
    //      "product" | "sizegroup" | "category" = grouped view
    public string? GroupBy { get; set; }
}