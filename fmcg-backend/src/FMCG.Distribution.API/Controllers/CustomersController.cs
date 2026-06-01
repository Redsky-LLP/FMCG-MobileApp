using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Customers.Commands;
using FMCG.Distribution.Application.Features.Customers.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]  // Base authorization - specific methods will narrow down
public class CustomersController(IMediator mediator, IApplicationDbContext context) : ControllerBase
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

    private string GetCurrentUserRole()
    {
        return User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
    }

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<CreateCustomerResponse>>> Create([FromBody] CreateCustomerCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<UpdateCustomerResponse>>> Update(Guid id, [FromBody] UpdateCustomerCommand command)
    {
        if (id != command.Id)
            return BadRequest(Result<UpdateCustomerResponse>.Failure("ID mismatch"));
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<bool>>> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteCustomerCommand { Id = id });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman,Accounts,Warehouse")]
    public async Task<ActionResult<Result<List<CustomerDto>>>> GetAll([FromQuery] Guid? routeId)
    {
        var userId = GetCurrentUserId();
        var userRole = GetCurrentUserRole();
        var isAdmin = IsAdmin();

        var query = new GetAllCustomersQuery
        {
            RouteId = routeId,
            CurrentUserId = userId,
            IsAdmin = isAdmin,
            UserRole = userRole
        };

        var result = await mediator.Send(query);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin,Salesman,Accounts,Warehouse")]
    public async Task<ActionResult<Result<CustomerDetailDto>>> GetById(Guid id)
    {
        var result = await mediator.Send(new GetCustomerByIdQuery { Id = id });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    // ── NEW: Reorder customers within a route ──────────────────────────────
    [HttpPost("reorder")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<bool>>> ReorderCustomers([FromBody] ReorderCustomersRequest request)
    {
        if (request.NewSequenceOrder < 1)
            return BadRequest(Result<bool>.Failure("Sequence must be at least 1"));

        var customers = await context.Customers
            .Where(c => c.RouteId == request.RouteId && !c.IsDeleted)
            .ToListAsync();

        if (!customers.Any())
            return NotFound(Result<bool>.Failure("No customers found for this route"));

        if (request.NewSequenceOrder > customers.Count)
            return BadRequest(Result<bool>.Failure($"Sequence cannot exceed {customers.Count}"));

        var customer = customers.FirstOrDefault(c => c.Id == request.CustomerId);
        if (customer == null)
            return NotFound(Result<bool>.Failure("Customer not found"));

        var oldSeq = customer.SequenceOrder;
        var newSeq = request.NewSequenceOrder;

        if (oldSeq == newSeq)
            return Ok(Result<bool>.Success(true, "No change needed"));

        var ordered = customers.OrderBy(c => c.SequenceOrder).ToList();
        var oldIndex = ordered.FindIndex(c => c.Id == request.CustomerId);
        var newIndex = newSeq - 1;

        var moved = ordered[oldIndex];
        ordered.RemoveAt(oldIndex);
        ordered.Insert(newIndex, moved);

        for (int i = 0; i < ordered.Count; i++)
        {
            ordered[i].SequenceOrder = i + 1;
        }

        await context.SaveChangesAsync();

        return Ok(Result<bool>.Success(true, "Customers reordered successfully"));
    }
}

// ── DTO for reorder request ──────────────────────────────────────────────────
public class ReorderCustomersRequest
{
    public Guid RouteId { get; set; }
    public Guid CustomerId { get; set; }
    public int NewSequenceOrder { get; set; }
}