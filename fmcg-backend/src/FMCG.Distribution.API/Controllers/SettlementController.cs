using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Settlement.Commands;
using FMCG.Distribution.Application.Features.Settlement.DTOs;
using FMCG.Distribution.Application.Features.Settlement.Queries;
using System.Security.Claims;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class SettlementController(IMediator mediator, IApplicationDbContext context) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
    }

    private bool IsAdmin()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        return role == "Admin" || role == "SuperAdmin";
    }

    private bool IsAccounts()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        return role == "Accounts" || role == "Admin" || role == "SuperAdmin";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/settlement/close-day
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("close-day")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<DailyClosureResultDto>>> CloseOperationalDay(
        [FromBody] CloseOperationalDayRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
        {
            return BadRequest(Result<DailyClosureResultDto>.Failure("User not authenticated."));
        }

        var command = new CloseOperationalDayCommand
        {
            ClosureDate = request.ClosureDate,
            Notes = request.Notes,
            AdminId = userId
        };

        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/settlement/summary
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("summary")]
    [Authorize(Roles = "Admin,SuperAdmin,Accounts")]
    public async Task<ActionResult<Result<ExpectedCashDto>>> GetSettlementSummary(
        [FromQuery] Guid? routeId,
        [FromQuery] DateTime? asOfDate)
    {
        var query = new GetSettlementSummaryQuery
        {
            RouteId = routeId,
            AsOfDate = asOfDate
        };

        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/settlement/outstanding
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("outstanding")]
    [Authorize(Roles = "Admin,SuperAdmin,Accounts,Salesman")]
    public async Task<ActionResult<Result<OutstandingSummaryDto>>> GetOutstanding(
        [FromQuery] Guid? customerId,
        [FromQuery] Guid? routeId)
    {
        var userId = GetCurrentUserId();
        var isAdmin = IsAdmin();
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        // Salesman can only see their assigned route's outstanding
        if (userRole == "Salesman" && !isAdmin)
        {
            // Get salesman's assigned route
            var routeIdForSalesman = await context.Routes
                .Where(r => r.AssignedSalesmanId == userId && !r.IsDeleted)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            if (routeIdForSalesman != Guid.Empty)
            {
                routeId = routeIdForSalesman;
            }
            else
            {
                return BadRequest(Result<OutstandingSummaryDto>.Failure("No route assigned to this salesman."));
            }
        }

        var query = new GetOutstandingByCustomerQuery
        {
            CustomerId = customerId,
            RouteId = routeId
        };

        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/settlement/status
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("status")]
    [Authorize(Roles = "Admin,SuperAdmin,Accounts")]
    public async Task<ActionResult<Result<DailyClosureStatusDto>>> GetClosureStatus(
        [FromQuery] DateTime? date)
    {
        var query = new GetDailyClosureStatusQuery
        {
            Date = date
        };

        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/settlement/record-payment
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("record-payment")]
    [Authorize(Roles = "Admin,SuperAdmin,Accounts")]
    public async Task<ActionResult<Result<RecordSettlementPaymentResponse>>> RecordPayment(
        [FromBody] RecordPaymentRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty)
        {
            return BadRequest(Result<RecordSettlementPaymentResponse>.Failure("User not authenticated."));
        }

        var command = new RecordSettlementPaymentCommand
        {
            CustomerId = request.CustomerId,
            Amount = request.Amount,
            PaymentDate = request.PaymentDate,
            PaymentReference = request.PaymentReference,
            PaymentMode = request.PaymentMode,
            Remarks = request.Remarks,
            RecordedByUserId = userId
        };

        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class CloseOperationalDayRequest
{
    public DateTime ClosureDate { get; set; }
    public string? Notes { get; set; }
}

public class RecordPaymentRequest
{
    public Guid CustomerId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string? PaymentReference { get; set; }
    public string? PaymentMode { get; set; }
    public string? Remarks { get; set; }
}