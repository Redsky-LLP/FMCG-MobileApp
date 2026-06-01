using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.ProductUnits.Commands;

public class DeleteProductUnitCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteProductUnitCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteProductUnitCommand request, CancellationToken cancellationToken)
    {
        var unit = await context.ProductUnits.FirstOrDefaultAsync(u => u.Id == request.Id && !u.IsDeleted, cancellationToken);

        if (unit == null)
        {
            return Result<bool>.Failure("Unit not found.");
        }

        // Check if unit is used by any product - CHANGE ProductUnitId to DefaultUnitId
        var hasProducts = await context.Products.AnyAsync(p => p.DefaultUnitId == request.Id && !p.IsDeleted, cancellationToken);
        if (hasProducts)
        {
            return Result<bool>.Failure("Cannot delete unit used by products. Deactivate instead.");
        }

        unit.SoftDelete("system");
        await context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Unit deleted successfully.");
    }
}