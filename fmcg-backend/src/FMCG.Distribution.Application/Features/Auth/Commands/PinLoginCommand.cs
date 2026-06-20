using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// Application/Features/Auth/Commands/PinLoginCommand.cs
using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

public class PinLoginCommand : IRequest<Result<LoginResponse>>
{
    public string Pin { get; set; } = string.Empty;  // ← ONLY PIN
}