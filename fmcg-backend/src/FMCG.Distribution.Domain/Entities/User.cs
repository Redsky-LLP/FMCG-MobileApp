using FMCG.Distribution.Domain.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Domain.Entities;

public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }

    // ── PIN Login ─────────────────────────────────────────────────────────────
    public string? PinHash { get; set; }              // BCrypt hash of the 4–6 digit PIN
    public int PinFailCount { get; set; } = 0;        // consecutive failed PIN attempts
    public DateTime? PinLockedUntil { get; set; }     // null = not locked
    // ─────────────────────────────────────────────────────────────────────────

    // Navigation property
    public virtual ICollection<Route>? AssignedRoutes { get; set; }
}