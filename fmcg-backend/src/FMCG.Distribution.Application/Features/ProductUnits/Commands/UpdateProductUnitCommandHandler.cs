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