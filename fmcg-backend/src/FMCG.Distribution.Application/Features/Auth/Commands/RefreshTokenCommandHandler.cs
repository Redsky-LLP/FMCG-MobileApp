using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// PATH: src/FMCG.Distribution.Application/Features/Auth/Commands/RefreshTokenCommandHandler.cs
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

public class RefreshTokenCommandHandler(IApplicationDbContext context, IConfiguration configuration)
    : IRequestHandler<RefreshTokenCommand, Result<RefreshTokenResponse>>
{
    public async Task<Result<RefreshTokenResponse>> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return Result<RefreshTokenResponse>.Failure("Refresh token is required.");
        }

        // ── FIX: was looking up the USER by a single shared RefreshToken column
        // (u.RefreshToken == request.RefreshToken). Since that column held only
        // ONE token per account regardless of how many devices/sessions had
        // logged into it, a second login on the same account (e.g. an admin or
        // tester using a salesman's PIN directly) silently overwrote it — the
        // first device's next silent refresh then found no match here and was
        // force-logged-out, even though its own token was never actually
        // revoked or expired. The token now lives on the SESSION that issued
        // it (see UserSession.RefreshToken), so this lookup only ever
        // succeeds or fails based on that one session's own state — a login
        // anywhere else can no longer affect it. Also excludes sessions that
        // have already been explicitly logged out (LogoutAt set), so a
        // logged-out session's leftover token can't be replayed to silently
        // resurrect it. ──
        var session = await context.UserSessions
            .Include(s => s.User)
            .FirstOrDefaultAsync(
                s => s.RefreshToken == request.RefreshToken && s.LogoutAt == null,
                cancellationToken);

        // No matching, still-active session — token invalid, already logged
        // out, or already rotated out by a previous refresh.
        if (session == null || session.User == null || !session.User.IsActive)
        {
            return Result<RefreshTokenResponse>.Failure("Invalid or expired session. Please log in again.");
        }

        // Refresh token itself has a 7-day expiry — past that, force a real login
        // rather than renewing forever on a token nobody has used in a week.
        if (session.RefreshTokenExpiry == null || session.RefreshTokenExpiry.Value < DateTime.UtcNow)
        {
            return Result<RefreshTokenResponse>.Failure("Session expired. Please log in again.");
        }

        // ── Issue a new access token, and rotate the refresh token — on THIS
        // session only. Rotating on every use means an actively-used app
        // effectively never needs a manual re-login — only 7+ days of total
        // inactivity on that specific session does. This still does NOT touch
        // LoginAt/LogoutAt — a silent refresh is a continuation of the same
        // session, not a new login/logout event — and it has no effect on any
        // other session row for this user. ──
        var newAccessToken = GenerateJwtToken(session.User);
        var newRefreshToken = GenerateRefreshToken();

        session.RefreshToken = newRefreshToken;
        session.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        await context.SaveChangesAsync(cancellationToken);

        return Result<RefreshTokenResponse>.Success(new RefreshTokenResponse
        {
            Token = newAccessToken,
            RefreshToken = newRefreshToken,
        });
    }

    private string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            configuration["Jwt:Key"] ?? "FMCG_Distribution_SuperSecretKey_32Chars_2024!"));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"] ?? "FMCG.Distribution",
            audience: configuration["Jwt:Audience"] ?? "FMCG.Distribution.Frontend",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(double.Parse(configuration["Jwt:ExpiryMinutes"] ?? "480")),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
        => Convert.ToBase64String(Guid.NewGuid().ToByteArray());
}