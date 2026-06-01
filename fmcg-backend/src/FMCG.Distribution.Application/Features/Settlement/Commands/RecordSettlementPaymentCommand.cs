using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Settlement.Commands;

public class RecordSettlementPaymentCommand : IRequest<Result<RecordSettlementPaymentResponse>>
{
    public Guid CustomerId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentMode { get; set; }
    public string? Remarks { get; set; }
    public Guid RecordedByUserId { get; set; }
}

public class RecordSettlementPaymentResponse
{
    public Guid PaymentId { get; set; }
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal RemainingOutstanding { get; set; }
    public DateTime PaymentDate { get; set; }
    public string? PaymentReference { get; set; }
    public bool FullySettled { get; set; }
}