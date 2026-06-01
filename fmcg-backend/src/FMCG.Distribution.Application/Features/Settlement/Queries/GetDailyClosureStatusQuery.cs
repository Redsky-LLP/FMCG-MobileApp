using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Settlement.DTOs;

namespace FMCG.Distribution.Application.Features.Settlement.Queries;

public class GetDailyClosureStatusQuery : IRequest<Result<DailyClosureStatusDto>>
{
    public DateTime? Date { get; set; }
    public Guid? RouteId { get; set; }
}

public class DailyClosureStatusDto
{
    public bool IsClosed { get; set; }
    public DateTime? ClosedAt { get; set; }
    public Guid? ClosedByUserId { get; set; }
    public string? ClosedByUserName { get; set; }
    public decimal? TotalSales { get; set; }
    public decimal? TotalOutstanding { get; set; }
    public decimal? ExpectedCash { get; set; }
    public string? Notes { get; set; }
}