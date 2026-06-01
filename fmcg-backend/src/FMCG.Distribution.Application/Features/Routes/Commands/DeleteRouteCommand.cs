using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Routes.Commands;

public class DeleteRouteCommand : IRequest<Result<bool>>
{
    public Guid Id { get; set; }
}