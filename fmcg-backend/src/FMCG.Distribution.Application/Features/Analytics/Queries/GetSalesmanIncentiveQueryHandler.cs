using MediatR;
using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Application.Common;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Application.Features.Incentives.DTOs;
using FMCG.Distribution.Domain.Enums;
using System.Security.Claims;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetSalesmanIncentiveQueryHandler(
    IApplicationDbContext context,
    IIncentiveService incentiveService)
    : IRequestHandler<GetSalesmanIncentiveQuery, Result<SalesmanIncentiveSummaryDto>>
{
    public async Task<Result<SalesmanIncentiveSummaryDto>> Handle(GetSalesmanIncentiveQuery request, CancellationToken cancellationToken)
    {
        var fromDate = request.FromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var toDate = request.ToDate ?? DateTime.UtcNow.Date;

        // If no salesman ID provided, get all salesmen
        if (!request.SalesmanId.HasValue)
        {
            // This would return aggregated data for all salesmen
            // For MVP, we'll require a specific salesman ID
            return Result<SalesmanIncentiveSummaryDto>.Failure("Salesman ID is required. For all salesmen report, use the route incentive endpoint.");
        }

        // Verify salesman exists and has correct role
        var salesman = await context.Users
            .FirstOrDefaultAsync(u => u.Id == request.SalesmanId.Value
                && u.Role == UserRole.Salesman
                && !u.IsDeleted, cancellationToken);

        if (salesman == null)
        {
            return Result<SalesmanIncentiveSummaryDto>.Failure("Salesman not found.");
        }

        // Calculate incentive using the incentive service
        var result = await incentiveService.CalculateSalesmanIncentiveAsync(
            request.SalesmanId.Value,
            fromDate,
            toDate,
            cancellationToken);

        return Result<SalesmanIncentiveSummaryDto>.Success(result);
    }
}