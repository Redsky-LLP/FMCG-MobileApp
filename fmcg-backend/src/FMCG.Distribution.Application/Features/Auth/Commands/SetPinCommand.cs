using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

/// <summary>
/// Allows a salesman (or admin on behalf) to set / change their PIN.
/// Must be authenticated — userId comes from the controller JWT claim.
/// </summary>
public class SetPinCommand : IRequest<Result<bool>>
{
    public Guid UserId { get; set; }
    public string Pin { get; set; } = string.Empty;       // 4–6 digits, validated here
}