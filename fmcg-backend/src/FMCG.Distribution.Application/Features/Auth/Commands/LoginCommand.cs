using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

public class LoginCommand : IRequest<Result<LoginResponse>>
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    /// <summary>The UserSession.Id created at login — pass this to POST /api/v1/auth/logout.</summary>
    public Guid SessionId { get; set; }
    /// <summary>
    /// True when this user logged in via PIN and their PIN hasn't been confirmed
    /// as the new 6-digit format yet. The frontend should force them through the
    /// "update your PIN" flow before letting them proceed. Always false for
    /// email/password logins.
    /// </summary>
    public bool RequiresPinUpdate { get; set; } = false;
}