using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class RecordCustomerVisitCommand : IRequest<Result<RecordCustomerVisitResponse>>
{
    public Guid ExecutionId { get; set; }
    public Guid CustomerId { get; set; }
    public VisitStatus Status { get; set; }
    public Guid? OrderId { get; set; }
    public string? SkipReason { get; set; }
    public Guid SalesmanId { get; set; }
}

public class RecordCustomerVisitResponse
{
    public Guid VisitId { get; set; }
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public VisitStatus Status { get; set; }
    public int SequenceOrder { get; set; }
    public int CompletedCount { get; set; }
    public int TotalCount { get; set; }
    public bool IsExecutionComplete { get; set; }
}