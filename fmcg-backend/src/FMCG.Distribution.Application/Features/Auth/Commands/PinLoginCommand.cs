using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

/// <summary>
/// Authenticates a salesman using their 4–6 digit PIN.
/// Returns the same LoginResponse as the password-based login
/// so the frontend can treat both flows identically.
/// </summary>
public class PinLoginCommand : IRequest<Result<LoginResponse>>
{
    public string Email { get; set; } = string.Empty;   // identifies the user
    public string Pin { get; set; } = string.Empty;
}