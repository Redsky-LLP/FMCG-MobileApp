// Application/Features/Users/Commands/CreateSalesmanCommandHandler.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Users.Commands;

public class CreateSalesmanCommandHandler : IRequestHandler<CreateSalesmanCommand, Result<CreateSalesmanResponse>>
{
    private readonly IApplicationDbContext _context;

    public CreateSalesmanCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CreateSalesmanResponse>> Handle(CreateSalesmanCommand request, CancellationToken cancellationToken)
    {
        // ── Validate Username ──
        if (string.IsNullOrWhiteSpace(request.UserName))
        {
            return Result<CreateSalesmanResponse>.Failure("Username is required.");
        }

        // Check uniqueness
        var exists = await _context.Users.AnyAsync(
            u => u.UserName == request.UserName, cancellationToken);
        if (exists)
        {
            return Result<CreateSalesmanResponse>.Failure("Username already taken.");
        }

        // ── Validate Full Name ──
        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            return Result<CreateSalesmanResponse>.Failure("Full name is required.");
        }

        // ── Validate PIN ──
        if (string.IsNullOrWhiteSpace(request.Pin) ||
            request.Pin.Length != 6 ||
            !request.Pin.All(char.IsDigit))
        {
            return Result<CreateSalesmanResponse>.Failure("PIN must be exactly 6 digits.");
        }

        // ── Reject duplicate PINs ────────────────────────────────────────────
        // Same reasoning as SetPinCommandHandler: PIN login scans every active
        // user's PinHash and stops at the first BCrypt match, so two people
        // sharing a PIN means one of them silently logs in as the other. This
        // check was missing here even after being added to Set PIN, which is
        // exactly how multiple salesmen ended up sharing the same PIN.
        var existingPinUsers = await _context.Users
            .Where(u => u.IsActive && u.PinHash != null)
            .Select(u => new { u.FullName, u.PinHash })
            .ToListAsync(cancellationToken);

        foreach (var existing in existingPinUsers)
        {
            if (BCrypt.Net.BCrypt.Verify(request.Pin, existing.PinHash))
            {
                return Result<CreateSalesmanResponse>.Failure(
                    $"This PIN is already used by {existing.FullName}. Choose a different one.");
            }
        }

        // ── Create User ──
        var user = new User
        {
            Id = Guid.NewGuid(),
            UserName = request.UserName,
            Email = request.Email ?? $"{request.UserName}@fmcg.local",
            FullName = request.FullName,
            Role = UserRole.Salesman,
            IsActive = true,
            PinHash = BCrypt.Net.BCrypt.HashPassword(request.Pin),
            PinFailCount = 0,
            PinLockedUntil = null,
            PinRequiresUpdate = false
        };

        await _context.Users.AddAsync(user, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<CreateSalesmanResponse>.Success(new CreateSalesmanResponse
        {
            Id = user.Id,
            UserName = user.UserName,
            FullName = user.FullName,
            Email = user.Email,
            IsActive = user.IsActive
        }, $"Salesman '{request.FullName}' created successfully.");
    }
}