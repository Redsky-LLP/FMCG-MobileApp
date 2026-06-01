using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

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

public class PinLoginCommandHandler(IApplicationDbContext context, IConfiguration configuration)
    : IRequestHandler<PinLoginCommand, Result<LoginResponse>>
{
    private const int MaxPinFailAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public async Task<Result<LoginResponse>> Handle(PinLoginCommand request, CancellationToken cancellationToken)
    {
        // 1. Find active user by email
        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.IsActive, cancellationToken);

        if (user == null)
        {
            return Result<LoginResponse>.Failure("Invalid credentials.");
        }

        // 2. Check PIN is configured
        if (string.IsNullOrEmpty(user.PinHash))
        {
            return Result<LoginResponse>.Failure("PIN not set. Please contact your administrator.");
        }

        // 3. Check lockout
        if (user.PinLockedUntil.HasValue && user.PinLockedUntil.Value > DateTime.UtcNow)
        {
            var remaining = (int)(user.PinLockedUntil.Value - DateTime.UtcNow).TotalMinutes + 1;
            return Result<LoginResponse>.Failure($"Account locked due to too many failed PIN attempts. Try again in {remaining} minute(s).");
        }

        // 4. Verify PIN
        if (!BCrypt.Net.BCrypt.Verify(request.Pin, user.PinHash))
        {
            user.PinFailCount += 1;

            if (user.PinFailCount >= MaxPinFailAttempts)
            {
                user.PinLockedUntil = DateTime.UtcNow.Add(LockoutDuration);
                user.PinFailCount = 0;
                await context.SaveChangesAsync(cancellationToken);
                return Result<LoginResponse>.Failure($"Too many failed attempts. Account locked for {(int)LockoutDuration.TotalMinutes} minutes.");
            }

            await context.SaveChangesAsync(cancellationToken);
            return Result<LoginResponse>.Failure($"Invalid PIN. {MaxPinFailAttempts - user.PinFailCount} attempt(s) remaining.");
        }

        // 5. Success — reset fail count, issue tokens
        user.PinFailCount = 0;
        user.PinLockedUntil = null;

        var jwtToken = GenerateJwtToken(user);
        var refreshToken = GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);

        await context.SaveChangesAsync(cancellationToken);

        return Result<LoginResponse>.Success(new LoginResponse
        {
            Token = jwtToken,
            RefreshToken = refreshToken,
            UserId = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role.ToString()
        });
    }

    // ── Duplicated from LoginCommandHandler intentionally (no shared service yet) ──
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