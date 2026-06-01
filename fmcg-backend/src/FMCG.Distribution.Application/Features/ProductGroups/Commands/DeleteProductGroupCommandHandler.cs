using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.ProductGroups.Commands;

public class DeleteProductGroupCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteProductGroupCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteProductGroupCommand request, CancellationToken cancellationToken)
    {
        var productGroup = await context.ProductGroups
            .FirstOrDefaultAsync(g => g.Id == request.Id && !g.IsDeleted, cancellationToken);

        if (productGroup == null)
        {
            return Result<bool>.Failure("Product group not found.");
        }

        var hasProducts = await context.Products
            .AnyAsync(p => p.ProductGroupId == request.Id && !p.IsDeleted, cancellationToken);
        if (hasProducts)
        {
            return Result<bool>.Failure("Cannot delete group with associated products. Deactivate instead.");
        }

        productGroup.SoftDelete("system");
        await context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Product group deleted successfully.");
    }
}