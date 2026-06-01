using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Application.Features.Incentives.DTOs;

// ─────────────────────────────────────────────────────────────────────────────
// Product Incentive DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class ProductIncentiveDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductNameMalayalam { get; set; }
    public decimal IncentiveValue { get; set; }
    public string IncentiveType { get; set; } = string.Empty;
    public DateTime EffectiveDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsActive { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateProductIncentiveDto
{
    public Guid ProductId { get; set; }
    public decimal IncentiveValue { get; set; }
    public IncentiveType IncentiveType { get; set; }
    public DateTime EffectiveDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Description { get; set; }
}

public class UpdateProductIncentiveDto
{
    public decimal IncentiveValue { get; set; }
    public IncentiveType IncentiveType { get; set; }
    public DateTime EffectiveDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsActive { get; set; }
    public string? Description { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Salesman Incentive DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class SalesmanIncentiveSummaryDto
{
    public Guid SalesmanId { get; set; }
    public string SalesmanName { get; set; } = string.Empty;
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalIncentive { get; set; }
    public List<IncentiveBreakdownDto> Breakdown { get; set; } = [];
}

public class IncentiveBreakdownDto
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal IncentiveRate { get; set; }
    public string IncentiveType { get; set; } = string.Empty;
    public decimal IncentiveEarned { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Incentive DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class RouteIncentiveSummaryDto
{
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalIncentive { get; set; }
    public int ActiveSalesmenCount { get; set; }
    public List<SalesmanIncentiveSummaryDto> Salesmen { get; set; } = [];
}