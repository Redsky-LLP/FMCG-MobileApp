using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TestController : ControllerBase
{
    [HttpGet("public")]
    public IActionResult Public()
    {
        return Ok(new { message = "This endpoint is public" });
    }

    [HttpGet("authenticated")]
    [Authorize]
    public IActionResult Authenticated()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        return Ok(new { message = "You are authenticated", userId, userRole });
    }

    [HttpGet("superadmin")]
    [Authorize(Policy = "SuperAdminOnly")]
    public IActionResult SuperAdminOnly()
    {
        return Ok(new { message = "Welcome Super Admin!" });
    }

    [HttpGet("admin")]
    [Authorize(Policy = "AdminOrSuperAdmin")]
    public IActionResult AdminOnly()
    {
        return Ok(new { message = "Welcome Admin!" });
    }

    [HttpGet("salesman")]
    [Authorize(Policy = "SalesmanOnly")]
    public IActionResult SalesmanOnly()
    {
        return Ok(new { message = "Welcome Salesman!" });
    }
}