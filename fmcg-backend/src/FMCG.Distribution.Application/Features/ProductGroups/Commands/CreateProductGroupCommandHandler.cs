using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Features.ProductGroups.Commands;

public class CreateProductGroupCommandHandler : IRequestHandler<CreateProductGroupCommand, Result<CreateProductGroupResponse>>
{
    private readonly IApplicationDbContext _context;

    public CreateProductGroupCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CreateProductGroupResponse>> Handle(CreateProductGroupCommand request, CancellationToken cancellationToken)
    {
        var productGroup = new ProductGroup
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            IsActive = true
        };

        await _context.ProductGroups.AddAsync(productGroup, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<CreateProductGroupResponse>.Success(new CreateProductGroupResponse
        {
            Id = productGroup.Id,
            Name = productGroup.Name,
            Description = productGroup.Description,
            IsActive = productGroup.IsActive
        }, "Product group created successfully.");
    }
}