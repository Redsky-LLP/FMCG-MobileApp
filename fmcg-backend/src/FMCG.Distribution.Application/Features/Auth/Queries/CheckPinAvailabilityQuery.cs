using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Auth.Queries;

/// <summary>
/// Checks whether a PIN is already in use by another active user — so the
/// admin gets an Instagram-style "already taken" warning while typing,
/// before two people end up sharing the same PIN.
///
/// This does NOT require storing PINs in plaintext. PinHash stays a one-way
/// hash; checking "does this PIN match any existing hash" only needs the
/// same BCrypt.Verify() the login flow already does, just run proactively
/// against the candidate value instead of against a login attempt.
/// </summary>
public class CheckPinAvailabilityQuery : IRequest<Result<CheckPinAvailabilityResponse>>
{
    public string Pin { get; set; } = string.Empty;

    /// <summary>The user currently being edited, if any — excluded from the
    /// conflict check so re-saving someone's own existing PIN doesn't flag
    /// itself as a collision.</summary>
    public Guid? ExcludeUserId { get; set; }
}

public class CheckPinAvailabilityResponse
{
    public bool IsAvailable { get; set; }
    public string? ConflictingUserName { get; set; }
}