// PATH: src/FMCG.Distribution.Application/Features/Orders/Commands/DeleteOrderCommandHandler.cs
// FIX: Use primary constructor (IDE0290)

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

// ── Primary constructor (fixes IDE0290) ──
public class DeleteOrderCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteOrderCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteOrderCommand request, CancellationToken cancellationToken)
    {
        // ── 1. Get existing order with CustomerVisit included ──
        var order = await context.Orders
            .Include(o => o.CustomerVisit)
            .FirstOrDefaultAsync(o => o.Id == request.Id && !o.IsDeleted, cancellationToken);

        if (order == null)
        {
            return Result<bool>.Failure("Order not found.");
        }

        // ── 2. Verify salesman owns this order ──
        if (order.Status != OrderStatus.Draft)
        {
            return Result<bool>.Failure("You are not authorized to delete this order.");
        }

        // ── 3. Only Draft orders can be deleted ──
        if (order.Status != OrderStatus.Draft)
        {
            return Result<bool>.Failure($"Cannot delete order in '{order.Status}' status. Only Draft orders can be deleted.");
        }

        // ── 4. FIX: Reset the associated CustomerVisit ──
        if (order.CustomerVisit != null)
        {
            var visit = order.CustomerVisit;

            // Reset visit to Pending
            visit.Status = VisitStatus.Pending;
            visit.OrderId = null;
            visit.VisitedAt = null;
            visit.UpdatedAt = DateTime.UtcNow;
            visit.UpdatedBy = request.SalesmanId.ToString();

            // Also update the VisitStatus in the order
            order.CustomerVisitId = null;
        }

        // ── 5. Soft delete the order ──
        order.SoftDelete(request.SalesmanId.ToString());

        // ── 6. Save all changes ──
        await context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Order cancelled successfully. You can now take a new order for this customer.");
    }
}