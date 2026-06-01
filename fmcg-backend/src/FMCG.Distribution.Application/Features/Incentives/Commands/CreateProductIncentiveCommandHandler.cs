using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Features.Incentives.Commands;

public class CreateProductIncentiveCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateProductIncentiveCommand, Result<CreateProductIncentiveResponse>>
{
    public async Task<Result<CreateProductIncentiveResponse>> Handle(CreateProductIncentiveCommand request, CancellationToken cancellationToken)
    {
        // Validate product exists
        var product = await context.Products
            .FirstOrDefaultAsync(p => p.Id == request.ProductId && !p.IsDeleted, cancellationToken);

        if (product == null)
        {
            return Result<CreateProductIncentiveResponse>.Failure("Product not found.");
        }

        // Validate incentive value is positive
        if (request.IncentiveValue <= 0)
        {
            return Result<CreateProductIncentiveResponse>.Failure("Incentive value must be greater than zero.");
        }

        // Validate effective date is not in distant past
        if (request.EffectiveDate > DateTime.UtcNow.AddDays(1))
        {
            return Result<CreateProductIncentiveResponse>.Failure("Effective date cannot be in the future.");
        }

        // Check for overlapping active incentive
        var overlappingIncentive = await context.ProductIncentives
            .AnyAsync(i => i.ProductId == request.ProductId
                && i.IsActive
                && i.EffectiveDate <= (request.EndDate ?? DateTime.MaxValue)
                && (!i.EndDate.HasValue || i.EndDate.Value >= request.EffectiveDate)
                && !i.IsDeleted, cancellationToken);

        if (overlappingIncentive)
        {
            return Result<CreateProductIncentiveResponse>.Failure("An active incentive already exists for this product during the specified period.");
        }

        var incentive = new ProductIncentive
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            IncentiveValue = request.IncentiveValue,
            IncentiveType = request.IncentiveType,
            EffectiveDate = request.EffectiveDate,
            EndDate = request.EndDate,
            IsActive = true,
            Description = request.Description
        };

        await context.ProductIncentives.AddAsync(incentive, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return Result<CreateProductIncentiveResponse>.Success(new CreateProductIncentiveResponse
        {
            Id = incentive.Id,
            ProductId = incentive.ProductId,
            ProductName = product.NameEnglish,
            IncentiveValue = incentive.IncentiveValue,
            IncentiveType = incentive.IncentiveType.ToString(),
            EffectiveDate = incentive.EffectiveDate,
            EndDate = incentive.EndDate,
            IsActive = incentive.IsActive,
            Description = incentive.Description
        }, "Product incentive created successfully.");
    }
}