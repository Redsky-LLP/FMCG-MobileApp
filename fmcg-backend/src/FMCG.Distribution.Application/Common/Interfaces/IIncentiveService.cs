using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using FMCG.Distribution.Application.Features.Incentives.DTOs;

namespace FMCG.Distribution.Application.Common.Interfaces;

public interface IIncentiveService
{
    Task<SalesmanIncentiveSummaryDto> CalculateSalesmanIncentiveAsync(
        Guid salesmanId,
        DateTime fromDate,
        DateTime toDate,
        CancellationToken cancellationToken = default);

    Task<RouteIncentiveSummaryDto> CalculateRouteIncentiveAsync(
        Guid routeId,
        DateTime fromDate,
        DateTime toDate,
        CancellationToken cancellationToken = default);

    Task<decimal> GetProductIncentiveRateAsync(
        Guid productId,
        DateTime asOfDate,
        CancellationToken cancellationToken = default);
}