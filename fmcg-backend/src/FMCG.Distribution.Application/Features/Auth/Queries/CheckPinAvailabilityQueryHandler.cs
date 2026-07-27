using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Application.Features.Auth.Queries;

public class CheckPinAvailabilityQueryHandler(IApplicationDbContext context)
    : IRequestHandler<CheckPinAvailabilityQuery, Result<CheckPinAvailabilityResponse>>
{
    public async Task<Result<CheckPinAvailabilityResponse>> Handle(
        CheckPinAvailabilityQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Pin) || !request.Pin.All(char.IsDigit))
        {
            return Result<CheckPinAvailabilityResponse>.Success(
                new CheckPinAvailabilityResponse { IsAvailable = true });
        }

        var candidates = await context.Users
            .AsNoTracking()
            .Where(u => u.IsActive
                && u.PinHash != null
                && (request.ExcludeUserId == null || u.Id != request.ExcludeUserId.Value))
            .Select(u => new { u.Id, u.FullName, u.PinHash })
            .ToListAsync(cancellationToken);

        foreach (var candidate in candidates)
        {
            if (BCrypt.Net.BCrypt.Verify(request.Pin, candidate.PinHash))
            {
                return Result<CheckPinAvailabilityResponse>.Success(new CheckPinAvailabilityResponse
                {
                    IsAvailable = false,
                    ConflictingUserName = candidate.FullName,
                });
            }
        }

        return Result<CheckPinAvailabilityResponse>.Success(
            new CheckPinAvailabilityResponse { IsAvailable = true });
    }
}