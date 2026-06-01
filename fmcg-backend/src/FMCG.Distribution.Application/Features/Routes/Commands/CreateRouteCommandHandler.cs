using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class CreateRouteCommandHandler : IRequestHandler<CreateRouteCommand, Result<CreateRouteResponse>>
{
    private readonly IApplicationDbContext _context;

    public CreateRouteCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CreateRouteResponse>> Handle(CreateRouteCommand request, CancellationToken cancellationToken)
    {
        var route = new Route
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            SequenceOrder = request.SequenceOrder,
            AssignedSalesmanId = request.AssignedSalesmanId,
            IsActive = true
        };

        await _context.Routes.AddAsync(route, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<CreateRouteResponse>.Success(new CreateRouteResponse
        {
            Id = route.Id,
            Name = route.Name,
            Description = route.Description,
            SequenceOrder = route.SequenceOrder,
            AssignedSalesmanId = route.AssignedSalesmanId,
            IsActive = route.IsActive
        }, "Route created successfully.");
    }
}