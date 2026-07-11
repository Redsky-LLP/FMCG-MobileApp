// Domain/Entities/User.cs
using FMCG.Distribution.Domain.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Domain.Entities;

public class User : BaseEntity
{
    // ── EXISTING FIELDS ──
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }

    // ── PIN Login (EXISTING) ──
    public string? PinHash { get; set; }
    public int PinFailCount { get; set; } = 0;
    public DateTime? PinLockedUntil { get; set; }

    // ── PIN Login (6-digit migration) ──
    // True whenever the PIN on file hasn't been confirmed to be the new
    // 6-digit format. We can't inspect PinHash (BCrypt is one-way) to see
    // how many digits the underlying PIN has, so every existing PIN is
    // conservatively flagged on migration and only cleared once the user
    // (re)sets a PIN through SetPinCommandHandler / CreateSalesmanCommandHandler,
    // both of which now require exactly 6 digits.
    public bool PinRequiresUpdate { get; set; } = true;

    // ── NEW: Username for Salesman ──
    public string? UserName { get; set; }

    // Navigation property
    public virtual ICollection<Route>? AssignedRoutes { get; set; }
}