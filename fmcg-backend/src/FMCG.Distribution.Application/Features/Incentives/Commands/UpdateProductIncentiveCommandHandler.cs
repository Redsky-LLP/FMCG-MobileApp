using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Incentives.Commands;

public class UpdateProductIncentiveCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateProductIncentiveCommand, Result<UpdateProductIncentiveResponse>>
{
    public async Task<Result<UpdateProductIncentiveResponse>> Handle(UpdateProductIncentiveCommand request, CancellationToken cancellationToken)
    {
        var incentive = await context.ProductIncentives
            .Include(i => i.Product)
            .FirstOrDefaultAsync(i => i.Id == request.Id && !i.IsDeleted, cancellationToken);

        if (incentive == null)
        {
            return Result<UpdateProductIncentiveResponse>.Failure("Product incentive not found.");
        }

        // Validate incentive value is positive
        if (request.IncentiveValue <= 0)
        {
            return Result<UpdateProductIncentiveResponse>.Failure("Incentive value must be greater than zero.");
        }

        // Check for overlapping active incentive (excluding current)
        var overlappingIncentive = await context.ProductIncentives
            .AnyAsync(i => i.ProductId == incentive.ProductId
                && i.Id != request.Id
                && i.IsActive
                && i.EffectiveDate <= (request.EndDate ?? DateTime.MaxValue)
                && (!i.EndDate.HasValue || i.EndDate.Value >= request.EffectiveDate)
                && !i.IsDeleted, cancellationToken);

        if (overlappingIncentive)
        {
            return Result<UpdateProductIncentiveResponse>.Failure("Another active incentive already exists for this product during the specified period.");
        }

        incentive.IncentiveValue = request.IncentiveValue;
        incentive.IncentiveType = request.IncentiveType;
        incentive.EffectiveDate = request.EffectiveDate;
        incentive.EndDate = request.EndDate;
        incentive.IsActive = request.IsActive;
        incentive.Description = request.Description;
        incentive.UpdateTimestamp(request.AdminId.ToString());

        await context.SaveChangesAsync(cancellationToken);

        return Result<UpdateProductIncentiveResponse>.Success(new UpdateProductIncentiveResponse
        {
            Id = incentive.Id,
            ProductId = incentive.ProductId,
            ProductName = incentive.Product?.NameEnglish ?? string.Empty,
            IncentiveValue = incentive.IncentiveValue,
            IncentiveType = incentive.IncentiveType.ToString(),
            EffectiveDate = incentive.EffectiveDate,
            EndDate = incentive.EndDate,
            IsActive = incentive.IsActive,
            Description = incentive.Description
        }, "Product incentive updated successfully.");
    }
}