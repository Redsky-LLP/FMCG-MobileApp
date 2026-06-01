using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Products.Commands;

public class DeleteProductCommand : IRequest<Result<bool>>
{
    public Guid Id { get; set; }
}