using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.ProductGroups.Commands;

public class UpdateProductGroupCommandHandler : IRequestHandler<UpdateProductGroupCommand, Result<UpdateProductGroupResponse>>
{
    private readonly IApplicationDbContext _context;

    public UpdateProductGroupCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<UpdateProductGroupResponse>> Handle(UpdateProductGroupCommand request, CancellationToken cancellationToken)
    {
        var productGroup = await _context.ProductGroups.FirstOrDefaultAsync(g => g.Id == request.Id && !g.IsDeleted, cancellationToken);

        if (productGroup == null)
        {
            return Result<UpdateProductGroupResponse>.Failure("Product group not found.");
        }

        productGroup.Name = request.Name;
        productGroup.Description = request.Description;
        productGroup.IsActive = request.IsActive;
        productGroup.UpdateTimestamp("system");

        await _context.SaveChangesAsync(cancellationToken);

        return Result<UpdateProductGroupResponse>.Success(new UpdateProductGroupResponse
        {
            Id = productGroup.Id,
            Name = productGroup.Name,
            Description = productGroup.Description,
            IsActive = productGroup.IsActive
        }, "Product group updated successfully.");
    }
}