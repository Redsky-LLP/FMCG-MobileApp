using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Incentives.Commands;

public class DeleteProductIncentiveCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteProductIncentiveCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteProductIncentiveCommand request, CancellationToken cancellationToken)
    {
        var incentive = await context.ProductIncentives
            .FirstOrDefaultAsync(i => i.Id == request.Id && !i.IsDeleted, cancellationToken);

        if (incentive == null)
        {
            return Result<bool>.Failure("Product incentive not found.");
        }

        incentive.SoftDelete(request.AdminId.ToString());
        await context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Product incentive deleted successfully.");
    }
}