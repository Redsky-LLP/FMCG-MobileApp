using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// PATH: src/FMCG.Distribution.Application/Features/Auth/Commands/AdminOverrideLoginCommandHandler.cs
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

public class AdminOverrideLoginCommandHandler : IRequestHandler<AdminOverrideLoginCommand, Result<LoginResponse>>
{
    private readonly IApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public AdminOverrideLoginCommandHandler(IApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<Result<LoginResponse>> Handle(AdminOverrideLoginCommand request, CancellationToken cancellationToken)
    {
        // ── Verify the Master PIN against whichever Admin/SuperAdmin account(s)
        // have one set. Mirrors PinLoginCommandHandler's scan-and-verify style,
        // but against MasterAccessPinHash instead of PinHash — a completely
        // separate column, so this can never be satisfied by a salesman's own
        // individual PIN, no matter what its digits happen to be. ──
        var adminCandidates = await _context.Users
            .Where(u => u.IsActive
                && u.MasterAccessPinHash != null
                && (u.Role == UserRole.Admin || u.Role == UserRole.SuperAdmin))
            .ToListAsync(cancellationToken);

        var masterPinValid = adminCandidates
            .Any(a => BCrypt.Net.BCrypt.Verify(request.MasterPin, a.MasterAccessPinHash));

        if (!masterPinValid)
        {
            return Result<LoginResponse>.Failure("Invalid Master Access PIN.");
        }

        // ── Look up the target salesman ──
        var salesman = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == request.SalesmanId
                && u.IsActive
                && u.Role == UserRole.Salesman,
                cancellationToken);

        if (salesman == null)
        {
            return Result<LoginResponse>.Failure("Salesman not found or inactive.");
        }

        // ── Issue a normal login for the SALESMAN — everything downstream
        // (route execution, order entry, etc.) works exactly as if the
        // salesman had logged in themselves. ──
        var token = GenerateJwtToken(salesman);
        var refreshToken = GenerateRefreshToken();

        salesman.RefreshToken = refreshToken;
        salesman.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);

        // ── Record the session with a distinct LoginMethod and a note of which
        // admin performed the override, so this is fully auditable later even
        // though it wasn't the salesman's own device/PIN doing the logging in. ──
        var adminUser = adminCandidates.FirstOrDefault(a => a.Id == request.AdminId);
        var session = new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = salesman.Id,
            LoginAt = DateTime.UtcNow,
            LoginMethod = "AdminOverride",
            DeviceHint = adminUser != null
                ? $"Via admin override by {adminUser.FullName}"
                : "Via admin override",
            CreatedAt = DateTime.UtcNow,
        };
        _context.UserSessions.Add(session);

        await _context.SaveChangesAsync(cancellationToken);

        return Result<LoginResponse>.Success(new LoginResponse
        {
            Token = token,
            RefreshToken = refreshToken,
            UserId = salesman.Id,
            Email = salesman.Email,
            FullName = salesman.FullName,
            Role = salesman.Role.ToString(),
            SessionId = session.Id,
            RequiresPinUpdate = false, // acting-as-salesman never forces a PIN update flow
        });
    }

    // ── Same JWT generation as PinLoginCommandHandler — kept as a private copy
    // here (rather than a shared helper) to avoid touching any existing,
    // already-working auth code as part of this change. ──
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