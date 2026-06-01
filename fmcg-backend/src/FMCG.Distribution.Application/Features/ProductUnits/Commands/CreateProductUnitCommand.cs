using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.ProductUnits.Commands;

public class CreateProductUnitCommand : IRequest<Result<CreateProductUnitResponse>>
{
    public string Name { get; set; } = string.Empty;
    public string? Symbol { get; set; }
}

public class CreateProductUnitResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Symbol { get; set; }
    public bool IsActive { get; set; }
}