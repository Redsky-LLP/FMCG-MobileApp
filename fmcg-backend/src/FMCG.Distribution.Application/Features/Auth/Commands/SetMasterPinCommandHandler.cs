using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// PATH: src/FMCG.Distribution.Application/Features/Auth/Commands/SetMasterPinCommandHandler.cs
using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

public class SetMasterPinCommandHandler(IApplicationDbContext context)
    : IRequestHandler<SetMasterPinCommand, Result<bool>>
{
    private const int PinLength = 6;

    public async Task<Result<bool>> Handle(SetMasterPinCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Pin)
            || request.Pin.Length != PinLength
            || !request.Pin.All(char.IsDigit))
        {
            return Result<bool>.Failure($"Master PIN must be exactly {PinLength} digits.");
        }

        var admin = await context.Users
            .FirstOrDefaultAsync(u => u.Id == request.AdminId
                && u.IsActive
                && (u.Role == UserRole.Admin || u.Role == UserRole.SuperAdmin),
                cancellationToken);

        if (admin == null)
        {
            return Result<bool>.Failure("Admin account not found.");
        }

        // ── No duplicate-check against salesman PINs needed here — the master
        // PIN is verified through a completely separate lookup
        // (AdminOverrideLoginCommandHandler only scans MasterAccessPinHash),
        // so it can't be confused with any individual salesman's own PIN even
        // if the digits happen to match. ──
        admin.MasterAccessPinHash = BCrypt.Net.BCrypt.HashPassword(request.Pin);
        admin.UpdateTimestamp(request.AdminId.ToString());

        await context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Master Access PIN set successfully.");
    }
}