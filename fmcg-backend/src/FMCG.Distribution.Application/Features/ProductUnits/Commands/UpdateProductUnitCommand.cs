using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.ProductUnits.Commands;

public class UpdateProductUnitCommand : IRequest<Result<UpdateProductUnitResponse>>
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Symbol { get; set; }
    public bool IsActive { get; set; }
}

public class UpdateProductUnitResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Symbol { get; set; }
    public bool IsActive { get; set; }
}