using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Features.ProductGroups.Commands;
using FMCG.Distribution.Application.Features.ProductGroups.Queries;

namespace FMCG.Distribution.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,Salesman,Accounts,Warehouse")]
public class ProductGroupsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Result<List<ProductGroupDto>>>> GetAll()
    {
        var result = await mediator.Send(new GetAllProductGroupsQuery());
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<CreateProductGroupResponse>>> Create(
        [FromBody] CreateProductGroupCommand command)
    {
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<UpdateProductGroupResponse>>> Update(
        Guid id, [FromBody] UpdateProductGroupCommand command)
    {
        if (id != command.Id)
            return BadRequest(Result<UpdateProductGroupResponse>.Failure("ID mismatch"));
        var result = await mediator.Send(command);
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<ActionResult<Result<bool>>> Delete(Guid id)
    {
        var result = await mediator.Send(new DeleteProductGroupCommand { Id = id });
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }
}