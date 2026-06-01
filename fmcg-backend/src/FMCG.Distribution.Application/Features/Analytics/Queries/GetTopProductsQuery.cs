using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Analytics.DTOs;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetTopProductsQuery : IRequest<Result<List<TopProductDto>>>
{
    public int Limit { get; set; } = 10;
    public string SortBy { get; set; } = "sales";  // "sales", "margin", "quantity"
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public Guid? ProductGroupId { get; set; }
}