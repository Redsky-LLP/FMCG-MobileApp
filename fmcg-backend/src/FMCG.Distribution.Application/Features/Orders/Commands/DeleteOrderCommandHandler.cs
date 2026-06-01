using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Orders.Commands;

public class DeleteOrderCommandHandler : IRequestHandler<DeleteOrderCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;

    public DeleteOrderCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<bool>> Handle(DeleteOrderCommand request, CancellationToken cancellationToken)
    {
        // Get existing order
        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.Id == request.Id && !o.IsDeleted, cancellationToken);

        if (order == null)
        {
            return Result<bool>.Failure("Order not found.");
        }

        // Verify salesman owns this order
        if (order.SalesmanId != request.SalesmanId)
        {
            return Result<bool>.Failure("You are not authorized to delete this order.");
        }

        // Only Draft orders can be deleted
        if (order.Status != OrderStatus.Draft)
        {
            return Result<bool>.Failure($"Cannot delete order in '{order.Status}' status. Only Draft orders can be deleted.");
        }

        // Soft delete the order (OrderItems will be cascade deleted)
        order.SoftDelete(request.SalesmanId.ToString());

        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Order deleted successfully.");
    }
}