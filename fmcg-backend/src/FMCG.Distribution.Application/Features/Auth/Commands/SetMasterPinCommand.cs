using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// PATH: src/FMCG.Distribution.Application/Features/Auth/Commands/SetMasterPinCommand.cs
using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

/// <summary>
/// Lets an authenticated Admin/SuperAdmin set or change their own Master Access
/// PIN — the single PIN used by AdminOverrideLoginCommand to act as any
/// salesman without needing that salesman's own individual PIN.
/// AdminId comes from the controller's JWT claim, same pattern as SetPinCommand.
/// </summary>
public class SetMasterPinCommand : IRequest<Result<bool>>
{
    public Guid AdminId { get; set; }
    public string Pin { get; set; } = string.Empty;   // exactly 6 digits, validated here
}