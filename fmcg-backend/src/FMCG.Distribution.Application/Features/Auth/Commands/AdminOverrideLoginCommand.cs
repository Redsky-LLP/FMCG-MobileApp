using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// PATH: src/FMCG.Distribution.Application/Features/Auth/Commands/AdminOverrideLoginCommand.cs
using MediatR;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.Auth.Commands;

namespace FMCG.Distribution.Application.Features.Auth.Commands;

/// <summary>
/// Lets an already-authenticated admin act as a chosen salesman — e.g. a
/// customer calls in after hours when the salesman isn't reachable, and the
/// admin needs to place or edit an order directly on that salesman's route.
/// The caller must already hold a valid Admin/SuperAdmin JWT (enforced by
/// [Authorize] on the controller action) — the Master PIN here is a second,
/// additional gate on top of that, not a replacement for normal login.
/// Returns a full LoginResponse for the TARGET SALESMAN, reusing the exact
/// same shape as PinLoginCommandHandler so the frontend can handle it with
/// its existing login-response logic.
/// </summary>
public class AdminOverrideLoginCommand : IRequest<Result<LoginResponse>>
{
    public Guid SalesmanId { get; set; }
    public string MasterPin { get; set; } = string.Empty;

    /// <summary>Set by the controller from the caller's JWT claim — used purely
    /// to record which admin performed the override in the session log, not
    /// for authorization (that's already covered by [Authorize] + the PIN).</summary>
    public Guid AdminId { get; set; }
}