using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// PATH: src/FMCG.Distribution.Application/Features/Reports/Queries/GetLoadingSheetAllQuery.cs

using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Reports.Queries;

public class GetLoadingSheetAllQuery : IRequest<Result<byte[]>>
{
    public DateTime? Date { get; set; }
}