using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.ProductUnits.Commands;

public class DeleteProductUnitCommand : IRequest<Result<bool>>
{
    public Guid Id { get; set; }
}