// Application/Features/Auth/Commands/PinLoginCommandHandler.cs
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
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

public class PinLoginCommandHandler : IRequestHandler<PinLoginCommand, Result<LoginResponse>>
{
    private readonly IApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private const int MaxPinAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public PinLoginCommandHandler(IApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<Result<LoginResponse>> Handle(PinLoginCommand request, CancellationToken cancellationToken)
    {
        // ── Find user by PIN (Salesman, Admin, SuperAdmin) ──
        // Get all active users with PIN hashes, for roles that may use PIN login.
        // Accounts/Warehouse aren't included — they still use email+password only.
        var candidates = await _context.Users
            .Where(u => u.IsActive
                && u.PinHash != null
                && (u.Role == UserRole.Salesman || u.Role == UserRole.Admin || u.Role == UserRole.SuperAdmin))
            .ToListAsync(cancellationToken);

        User? user = null;
        foreach (var candidate in candidates)
        {
            if (BCrypt.Net.BCrypt.Verify(request.Pin, candidate.PinHash))
            {
                user = candidate;
                break;
            }
        }

        // ── No user found with this PIN ──
        if (user == null)
        {
            return Result<LoginResponse>.Failure("Invalid PIN.");
        }

        // ── Check lockout ──
        if (user.PinLockedUntil.HasValue && user.PinLockedUntil.Value > DateTime.UtcNow)
        {
            var remaining = (int)(user.PinLockedUntil.Value - DateTime.UtcNow).TotalMinutes + 1;
            return Result<LoginResponse>.Failure($"Account locked. Try again in {remaining} minute(s).");
        }

        // ── Success ──
        user.PinFailCount = 0;
        user.PinLockedUntil = null;

        var token = GenerateJwtToken(user);
        var refreshToken = GenerateRefreshToken();

        // ── FIX: this used to also do
        //     user.RefreshToken = refreshToken;
        //     user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        // — but that's a SINGLE column per user, shared across every device
        // that ever logs into this account. Anyone else logging in with the
        // SAME PIN (e.g. an admin or a tester checking something on their
        // own phone/laptop, using a salesman's PIN directly rather than the
        // separate Master-PIN "Act As" flow) silently overwrote whatever
        // refresh token the salesman's own tablet was holding. The tablet
        // kept working until it next tried to silently refresh — at that
        // point the stored token no longer matched, refresh failed, and the
        // salesman was force-logged-out with no warning, potentially losing
        // an in-progress order. This is the "signed out multiple times a
        // day" bug.
        //
        // Fix: the refresh token is now stored on THIS session row instead
        // (see UserSession.RefreshToken) — every login creates its own
        // session with its own token, so logging into the same account from
        // a second device can never touch or invalidate the first device's
        // session. Multiple concurrent sessions per account now work
        // correctly, and a session only ever ends via explicit logout, its
        // own 7-day refresh-token expiry, or direct revocation. ──
        var session = new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            LoginAt = DateTime.UtcNow,
            LoginMethod = "PIN",
            RefreshToken = refreshToken,
            RefreshTokenExpiry = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
        };
        _context.UserSessions.Add(session);

        await _context.SaveChangesAsync(cancellationToken);

        return Result<LoginResponse>.Success(new LoginResponse
        {
            Token = token,
            RefreshToken = refreshToken,
            UserId = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            SessionId = session.Id,
            RequiresPinUpdate = user.PinRequiresUpdate,
        });
    }

    // ── Helper methods ──
    private string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _configuration["Jwt:Key"] ?? "FMCG_Distribution_SuperSecretKey_32Chars_2024!"));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "FMCG.Distribution",
            audience: _configuration["Jwt:Audience"] ?? "FMCG.Distribution.Frontend",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(double.Parse(_configuration["Jwt:ExpiryMinutes"] ?? "480")),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
        => Convert.ToBase64String(Guid.NewGuid().ToByteArray());
}