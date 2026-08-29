// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetRetailSheetQuery.cs

using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetRetailSheetQuery : IRequest<Result<byte[]>>
{
    public Guid? RouteId { get; set; }
    public DateTime? Date { get; set; }
}