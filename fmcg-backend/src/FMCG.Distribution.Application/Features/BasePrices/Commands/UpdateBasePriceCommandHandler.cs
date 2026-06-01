using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.BasePrices.Commands;

public class UpdateBasePriceCommandHandler : IRequestHandler<UpdateBasePriceCommand, Result<UpdateBasePriceResponse>>
{
    private readonly IApplicationDbContext _context;

    public UpdateBasePriceCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<UpdateBasePriceResponse>> Handle(UpdateBasePriceCommand request, CancellationToken cancellationToken)
    {
        // Validate product exists
        var product = await _context.Products
            .FirstOrDefaultAsync(p => p.Id == request.ProductId && !p.IsDeleted, cancellationToken);

        if (product == null)
        {
            return Result<UpdateBasePriceResponse>.Failure("Product not found.");
        }

        // Validate new price is positive
        if (request.NewPrice <= 0)
        {
            return Result<UpdateBasePriceResponse>.Failure("Price must be greater than zero.");
        }

        // Check if price actually changed
        if (product.BasePrice == request.NewPrice)
        {
            return Result<UpdateBasePriceResponse>.Failure("New price is same as current price. No update needed.");
        }

        var oldPrice = product.BasePrice;
        var effectiveDate = DateTime.UtcNow;

        // 1. Deactivate current active BasePrice record (if exists)
        var currentBasePrice = await _context.BasePrices
            .FirstOrDefaultAsync(bp => bp.ProductId == request.ProductId && bp.IsActive, cancellationToken);

        if (currentBasePrice != null)
        {
            currentBasePrice.IsActive = false;
            currentBasePrice.UpdatedAt = DateTime.UtcNow;
        }

        // 2. Create new BasePrice record
        var newBasePrice = new BasePrice
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            Price = request.NewPrice,
            EffectiveDate = effectiveDate,
            IsActive = true,
            Reason = request.Reason,
            CreatedAt = DateTime.UtcNow
        };
        await _context.BasePrices.AddAsync(newBasePrice, cancellationToken);

        // 3. Update Product's current BasePrice
        product.BasePrice = request.NewPrice;
        product.UpdatedAt = DateTime.UtcNow;

        // 4. Create audit log entry
        var auditLog = new PricingAuditLog
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            OldPrice = oldPrice,
            NewPrice = request.NewPrice,
            Action = PricingAction.Update,
            Reason = request.Reason,
            ModifiedBy = request.AdminId.ToString(),
            CreatedAt = DateTime.UtcNow
        };
        await _context.PricingAuditLogs.AddAsync(auditLog, cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);

        return Result<UpdateBasePriceResponse>.Success(new UpdateBasePriceResponse
        {
            ProductId = product.Id,
            ProductName = product.NameEnglish,
            OldPrice = oldPrice,
            NewPrice = request.NewPrice,
            EffectiveDate = effectiveDate
        }, "Base price updated successfully.");
    }
}