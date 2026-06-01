using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Incentives.DTOs;

namespace FMCG.Distribution.Application.Features.Incentives.Queries;

public class GetProductIncentivesQuery : IRequest<Result<List<ProductIncentiveDto>>>
{
    public Guid? ProductId { get; set; }
    public bool? IsActive { get; set; }
}