using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Features.Products.Commands;

public class CreateProductCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateProductCommand, Result<CreateProductResponse>>
{
    public async Task<Result<CreateProductResponse>> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        // ItemCode is mandatory for every product — enforced here too, not just
        // in the admin UI, since it's also where the price comes from (the
        // "1000-90" convention: the admin form parses the price out of it
        // client-side, but the server shouldn't trust that alone).
        if (string.IsNullOrWhiteSpace(request.ItemCode))
        {
            return Result<CreateProductResponse>.Failure("Item Code is required.");
        }

        // Verify ProductGroup exists
        var productGroup = await context.ProductGroups
            .FirstOrDefaultAsync(g => g.Id == request.ProductGroupId && !g.IsDeleted, cancellationToken);
        if (productGroup == null)
        {
            return Result<CreateProductResponse>.Failure("Product group not found.");
        }

        // Verify ProductUnit exists - CHANGE ProductUnitId to DefaultUnitId
        var unit = await context.ProductUnits
            .FirstOrDefaultAsync(u => u.Id == request.ProductUnitId && !u.IsDeleted, cancellationToken);
        if (unit == null)
        {
            return Result<CreateProductResponse>.Failure("Unit not found.");
        }

        var product = new Product
        {
            Id = Guid.NewGuid(),
            NameEnglish = request.NameEnglish,
            NameMalayalam = request.NameMalayalam,
            ProductGroupId = request.ProductGroupId,
            DefaultUnitId = request.ProductUnitId,  // ← CHANGE THIS
            BasePrice = request.BasePrice,
            ItemCode = request.ItemCode,
            Sku = request.Sku,
            HSNCode = request.HSNCode,
            Supplier = request.Supplier,
            ClosingStock = request.ClosingStock ?? 0,
            MinOrderQty = request.MinOrderQty,
            MaxOrderQty = request.MaxOrderQty,
            IsActive = true
        };

        await context.Products.AddAsync(product, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return Result<CreateProductResponse>.Success(new CreateProductResponse
        {
            Id = product.Id,
            NameEnglish = product.NameEnglish,
            NameMalayalam = product.NameMalayalam,
            ProductGroupId = product.ProductGroupId,
            ProductUnitId = product.DefaultUnitId,  // ← CHANGE THIS (mapping to response)
            BasePrice = product.BasePrice,
            IsActive = product.IsActive,
            ItemCode = product.ItemCode
        }, "Product created successfully.");
    }
}