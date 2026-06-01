using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Analytics.DTOs;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetProductPerformanceQuery : IRequest<Result<ProductPerformanceResponseDto>>
{
    public Guid? ProductGroupId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public int? Limit { get; set; }
    public string? SortBy { get; set; }  // "sales", "margin", "quantity"
}