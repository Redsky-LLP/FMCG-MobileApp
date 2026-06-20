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

        var user = await context.Users.FirstOrDefaultAsync(
            u => u.RefreshToken == request.RefreshToken && u.IsActive, cancellationToken);

        // Invalid token, or it doesn't match any user (e.g. already rotated
        // out by a previous refresh, or the account was deactivated).
        if (user == null)
        {
            return Result<RefreshTokenResponse>.Failure("Invalid or expired session. Please log in again.");
        }

        // Refresh token itself has a 7-day expiry — past that, force a real login
        // rather than renewing forever on a token nobody has used in a week.
        if (user.RefreshTokenExpiry == null || user.RefreshTokenExpiry.Value < DateTime.UtcNow)
        {
            return Result<RefreshTokenResponse>.Failure("Session expired. Please log in again.");
        }

        // ── Issue a new access token, and rotate the refresh token ──
        // Rotating on every use means an actively-used app effectively never
        // needs a manual re-login — only 7+ days of total inactivity does.
        // NOTE: this does NOT touch UserSessions — a silent refresh is a
        // continuation of the same session, not a new login/logout event.
        var newAccessToken = GenerateJwtToken(user);
        var newRefreshToken = GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
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