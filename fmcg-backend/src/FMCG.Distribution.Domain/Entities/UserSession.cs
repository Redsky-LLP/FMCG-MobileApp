using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// PATH: src/FMCG.Distribution.Domain/Entities/UserSession.cs
using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

/// <summary>
/// Records every login and logout event for a user.
/// Each row is one session: LoginAt is always set; LogoutAt is null
/// until the user explicitly logs out (or the session is invalidated).
/// </summary>
public class UserSession : BaseEntity
{
    public Guid UserId { get; set; }
    public virtual User? User { get; set; }

    public DateTime LoginAt { get; set; }
    public DateTime? LogoutAt { get; set; }

    /// <summary>
    /// "Email", "PIN" — so the admin can see which login method was used.
    /// </summary>
    public string LoginMethod { get; set; } = "Email";

    /// <summary>
    /// Rough location hint from the browser User-Agent header (device type).
    /// </summary>
    public string? DeviceHint { get; set; }

    // ── FIX: refresh token now lives PER SESSION, not on User. It used to be
    // a single column on the User row, shared by every device/session that
    // account ever logged into. That meant if the same account (e.g. a
    // salesman's PIN, used directly by an admin or a tester to check
    // something) logged in from a SECOND device, the second login silently
    // overwrote the first device's stored refresh token. The first device
    // kept working until its short-lived access token expired and it tried
    // to silently refresh — at that point the stored token no longer
    // matched, refresh failed, and that device was force-logged-out with no
    // warning, potentially losing an in-progress order. Storing the token
    // here instead means every login creates its OWN session row with its
    // OWN token — logging in elsewhere can never touch or invalidate a
    // different session's token, so multiple devices can stay signed in on
    // the same account at once, and a session only ever ends when it's
    // explicitly logged out, its own refresh token expires from real
    // inactivity (7 days), or it's revoked directly. ──
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
}