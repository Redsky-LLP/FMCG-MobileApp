using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

public class SetPinCommandHandler(IApplicationDbContext context)
    : IRequestHandler<SetPinCommand, Result<bool>>
{
    private const int PinMinLength = 4;
    private const int PinMaxLength = 6;

    public async Task<Result<bool>> Handle(SetPinCommand request, CancellationToken cancellationToken)
    {
        // Validate PIN format
        if (string.IsNullOrWhiteSpace(request.Pin)
            || request.Pin.Length < PinMinLength
            || request.Pin.Length > PinMaxLength
            || !request.Pin.All(char.IsDigit))
        {
            return Result<bool>.Failure($"PIN must be {PinMinLength}–{PinMaxLength} digits.");
        }

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Id == request.UserId && u.IsActive, cancellationToken);

        if (user == null)
        {
            return Result<bool>.Failure("User not found.");
        }

        user.PinHash = BCrypt.Net.BCrypt.HashPassword(request.Pin);
        user.PinFailCount = 0;
        user.PinLockedUntil = null;
        user.UpdateTimestamp(request.UserId.ToString());

        await context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "PIN set successfully.");
    }
}