using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.PricingAudit.Queries;

public class GetPricingAuditLogQuery : IRequest<Result<List<PricingAuditLogDto>>>
{
    public Guid? ProductId { get; set; }
    public PricingAction? Action { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public int? Limit { get; set; }
}

public class PricingAuditLogDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal OldPrice { get; set; }
    public decimal NewPrice { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string ModifiedBy { get; set; } = string.Empty;
    public DateTime ModifiedAt { get; set; }
}