using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Products.Commands;

public class CreateProductCommand : IRequest<Result<CreateProductResponse>>
{
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public Guid ProductGroupId { get; set; }
    public Guid ProductUnitId { get; set; }
    public decimal BasePrice { get; set; }
}

public class CreateProductResponse
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public Guid ProductGroupId { get; set; }
    public Guid ProductUnitId { get; set; }
    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; }
}