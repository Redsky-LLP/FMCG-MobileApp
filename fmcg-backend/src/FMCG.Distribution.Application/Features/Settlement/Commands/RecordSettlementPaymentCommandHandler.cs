using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Settlement.Commands;

public class RecordSettlementPaymentCommandHandler(IApplicationDbContext context)
    : IRequestHandler<RecordSettlementPaymentCommand, Result<RecordSettlementPaymentResponse>>
{
    public async Task<Result<RecordSettlementPaymentResponse>> Handle(RecordSettlementPaymentCommand request, CancellationToken cancellationToken)
    {
        // Validate customer exists
        var customer = await context.Customers
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId && !c.IsDeleted, cancellationToken);

        if (customer == null)
        {
            return Result<RecordSettlementPaymentResponse>.Failure("Customer not found.");
        }

        // Validate amount is positive
        if (request.Amount <= 0)
        {
            return Result<RecordSettlementPaymentResponse>.Failure("Payment amount must be greater than zero.");
        }

        // Get current outstanding for this customer
        var outstandings = await context.Outstandings
            .Where(o => o.CustomerId == request.CustomerId
                && !o.IsDeleted
                && o.SettlementStatus != SettlementStatus.Settled)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(cancellationToken);

        var totalOutstanding = outstandings.Sum(o => o.OutstandingAmount);
        var remainingAmount = request.Amount;
        var fullySettled = false;

        // Apply payment to outstanding records (FIFO)
        foreach (var outstanding in outstandings)
        {
            if (remainingAmount <= 0) break;

            if (remainingAmount >= outstanding.OutstandingAmount)
            {
                // Fully settle this outstanding record
                remainingAmount -= outstanding.OutstandingAmount;
                outstanding.OutstandingAmount = 0;
                outstanding.SettlementStatus = SettlementStatus.Settled;
                outstanding.SettledAt = DateTime.UtcNow;
                outstanding.SettlementReference = request.PaymentReference;
                outstanding.UpdateTimestamp(request.RecordedByUserId.ToString());

                // Update linked order if exists
                if (outstanding.OrderId.HasValue)
                {
                    var order = await context.Orders
                        .FirstOrDefaultAsync(o => o.Id == outstanding.OrderId.Value, cancellationToken);
                    if (order != null)
                    {
                        order.SettlementStatus = SettlementStatus.Settled;
                        order.UpdateTimestamp(request.RecordedByUserId.ToString());
                    }
                }
            }
            else
            {
                // Partially settle this outstanding record
                outstanding.OutstandingAmount -= remainingAmount;
                outstanding.SettlementStatus = SettlementStatus.PartiallySettled;
                outstanding.UpdateTimestamp(request.RecordedByUserId.ToString());
                remainingAmount = 0;

                // Update linked order if exists
                if (outstanding.OrderId.HasValue)
                {
                    var order = await context.Orders
                        .FirstOrDefaultAsync(o => o.Id == outstanding.OrderId.Value, cancellationToken);
                    if (order != null)
                    {
                        order.SettlementStatus = SettlementStatus.PartiallySettled;
                        order.UpdateTimestamp(request.RecordedByUserId.ToString());
                    }
                }
            }
        }

        fullySettled = remainingAmount >= 0 && outstandings.All(o => o.SettlementStatus == SettlementStatus.Settled);

        // Create payment record
        var payment = new SettlementPayment
        {
            Id = Guid.NewGuid(),
            CustomerId = request.CustomerId,
            Amount = request.Amount,
            PaymentDate = request.PaymentDate,
            PaymentReference = request.PaymentReference,
            PaymentMode = request.PaymentMode,
            Remarks = request.Remarks,
            RecordedByUserId = request.RecordedByUserId
        };

        await context.SettlementPayments.AddAsync(payment, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        // Calculate remaining outstanding
        var remainingOutstanding = outstandings.Sum(o => o.OutstandingAmount);

        return Result<RecordSettlementPaymentResponse>.Success(new RecordSettlementPaymentResponse
        {
            PaymentId = payment.Id,
            CustomerId = customer.Id,
            CustomerName = customer.NameEnglish,
            Amount = request.Amount,
            RemainingOutstanding = remainingOutstanding,
            PaymentDate = request.PaymentDate,
            PaymentReference = request.PaymentReference,
            FullySettled = fullySettled
        }, "Payment recorded successfully.");
    }
}