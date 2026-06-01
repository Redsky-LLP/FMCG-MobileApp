// PATH: src/FMCG.Distribution.Application/Features/Auth/Commands/RegisterCommandHandler.cs
// MODIFIED — blocks self-registration to Admin/SuperAdmin roles

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

public class RegisterCommandHandler(IApplicationDbContext context)
    : IRequestHandler<RegisterCommand, Result<RegisterResponse>>
{
    // Roles that can self-register via the public /register endpoint.
    // Admin and SuperAdmin must be created by a SuperAdmin via the Users endpoint.
    private static readonly UserRole[] AllowedSelfRegisterRoles =
    [
        UserRole.Salesman,
        UserRole.Accounts,
        UserRole.Warehouse,
    ];

    public async Task<Result<RegisterResponse>> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        // 1. Check for duplicate email
        var exists = await context.Users.AnyAsync(u => u.Email == request.Email, cancellationToken);
        if (exists)
            return Result<RegisterResponse>.Failure("User with this email already exists.");

        // 2. Parse and validate role
        if (!Enum.TryParse<UserRole>(request.Role, ignoreCase: true, out var userRole))
            return Result<RegisterResponse>.Failure(
                $"Invalid role '{request.Role}'. Valid roles: Salesman, Accounts, Warehouse.");

        // 3. Block privileged role self-registration
        if (!AllowedSelfRegisterRoles.Contains(userRole))
            return Result<RegisterResponse>.Failure(
                $"Role '{request.Role}' cannot be self-registered. Contact your system administrator to create Admin accounts.");

        // 4. Create the user
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            Role = userRole,
            IsActive = true
        };

        await context.Users.AddAsync(user, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        return Result<RegisterResponse>.Success(new RegisterResponse
        {
            UserId = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role.ToString()
        }, "User registered successfully.");
    }
}