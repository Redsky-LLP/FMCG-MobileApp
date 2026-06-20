using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// PATH: src/FMCG.Distribution.Application/Features/Auth/Commands/RefreshTokenCommand.cs
using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

/// <summary>
/// Silently renews an access token using the refresh token, without requiring
/// the user to log in again. This is what keeps a field salesman logged in
/// through gaps between shop visits, lunch breaks, or even overnight, as long
/// as they open the app at least once within the refresh token's lifetime.
/// </summary>
public class RefreshTokenCommand : IRequest<Result<RefreshTokenResponse>>
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class RefreshTokenResponse
{
    public string Token { get; set; } = string.Empty;
    /// <summary>
    /// The refresh token is rotated on every use (sliding expiry) — the old
    /// one becomes invalid immediately. This means an actively-used session
    /// effectively never expires; only true inactivity (7+ days with the app
    /// never opened) forces a real re-login.
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;
}