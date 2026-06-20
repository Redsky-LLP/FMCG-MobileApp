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

    // ── NEW: Username for Salesman ──
    public string? UserName { get; set; }

    // Navigation property
    public virtual ICollection<Route>? AssignedRoutes { get; set; }
}