// Application/Features/Users/Commands/CreateSalesmanCommand.cs
using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Users.Commands;

public class CreateSalesmanCommand : IRequest<Result<CreateSalesmanResponse>>
{
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Pin { get; set; } = string.Empty;
    public string? Email { get; set; }
}

public class CreateSalesmanResponse
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public bool IsActive { get; set; }
}