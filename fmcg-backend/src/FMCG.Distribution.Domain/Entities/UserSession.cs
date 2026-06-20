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
}