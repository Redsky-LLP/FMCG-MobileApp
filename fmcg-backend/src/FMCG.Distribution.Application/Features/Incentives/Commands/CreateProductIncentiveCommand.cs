using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Incentives.Commands;

public class CreateProductIncentiveCommand : IRequest<Result<CreateProductIncentiveResponse>>
{
    public Guid ProductId { get; set; }
    public decimal IncentiveValue { get; set; }
    public IncentiveType IncentiveType { get; set; }
    public DateTime EffectiveDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Description { get; set; }
    public Guid AdminId { get; set; }
}

public class CreateProductIncentiveResponse
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal IncentiveValue { get; set; }
    public string IncentiveType { get; set; } = string.Empty;
    public DateTime EffectiveDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsActive { get; set; }
    public string? Description { get; set; }
}