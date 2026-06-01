using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.ProductGroups.Commands;

public class DeleteProductGroupCommand : IRequest<Result<bool>>
{
    public Guid Id { get; set; }
}