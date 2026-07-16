// PATH: src/FMCG.Distribution.Application/Features/ProductUnits/Commands/UpdateProductUnitCommandHandler.cs
// FIX: Added guard to prevent deactivating units that are still assigned to active products

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.ProductUnits.Commands;

public class UpdateProductUnitCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateProductUnitCommand, Result<UpdateProductUnitResponse>>
{
    public async Task<Result<UpdateProductUnitResponse>> Handle(UpdateProductUnitCommand request, CancellationToken cancellationToken)
    {
        var unit = await context.ProductUnits.FirstOrDefaultAsync(u => u.Id == request.Id && !u.IsDeleted, cancellationToken);

        if (unit == null)
        {
            return Result<UpdateProductUnitResponse>.Failure("Unit not found.");
        }

        // ── Guard: Prevent deactivating units still assigned to active products ──
        // This closes the loop from the deactivation side — mirroring the delete guard
        // in DeleteProductUnitCommandHandler. Deactivating a packing category that's
        // still a product's default unit would cause orders to fail silently.
        if (!request.IsActive)
        {
            var stillInUse = await context.Products
                .AnyAsync(p => p.DefaultUnitId == request.Id && p.IsActive && !p.IsDeleted, cancellationToken);
            if (stillInUse)
                return Result<UpdateProductUnitResponse>.Failure(
                    "This packing category is still assigned to one or more active products — reassign them to a different unit before deactivating.");
        }

        unit.Name = request.Name;
        unit.Symbol = request.Symbol;
        unit.IsActive = request.IsActive;
        unit.UpdateTimestamp("system");

        await context.SaveChangesAsync(cancellationToken);

        return Result<UpdateProductUnitResponse>.Success(new UpdateProductUnitResponse
        {
            Id = unit.Id,
            Name = unit.Name,
            Symbol = unit.Symbol,
            IsActive = unit.IsActive
        }, "Unit updated successfully.");
    }
}