using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Incentives.Commands;

public class DeleteProductIncentiveCommand : IRequest<Result<bool>>
{
    public Guid Id { get; set; }
    public Guid AdminId { get; set; }
}