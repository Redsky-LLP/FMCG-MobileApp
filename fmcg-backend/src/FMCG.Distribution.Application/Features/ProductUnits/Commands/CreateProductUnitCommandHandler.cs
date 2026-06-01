using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Features.ProductUnits.Commands;

public class CreateProductUnitCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateProductUnitCommand, Result<CreateProductUnitResponse>>
{
    public async Task<Result<CreateProductUnitResponse>> Handle(CreateProductUnitCommand request, CancellationToken cancellationToken)
    {
        var unit = new ProductUnit
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Symbol = request.Symbol,
            IsActive = true
        };

        await context.ProductUnits.AddAsync(unit, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return Result<CreateProductUnitResponse>.Success(new CreateProductUnitResponse
        {
            Id = unit.Id,
            Name = unit.Name,
            Symbol = unit.Symbol,
            IsActive = unit.IsActive
        }, "Unit created successfully.");
    }
}