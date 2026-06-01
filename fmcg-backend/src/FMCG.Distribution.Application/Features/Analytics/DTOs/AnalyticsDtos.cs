namespace FMCG.Distribution.Application.Features.Analytics.DTOs;

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard KPIs DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class DashboardKpisDto
{
    public KpiCardDto TotalSales { get; set; } = new();
    public KpiCardDto TotalOrders { get; set; } = new();
    public KpiCardDto AverageOrderValue { get; set; } = new();
    public KpiCardDto MarginPercentage { get; set; } = new();
    public KpiCardDto OutstandingAmount { get; set; } = new();
    public List<TopProductDto> TopProducts { get; set; } = [];
    public List<RoutePerformanceSummaryDto> RoutePerformance { get; set; } = [];
    public List<SalesmanIncentiveSummaryDto> TopSalesmen { get; set; } = [];
    public DateTime AsOfDate { get; set; }
    public DateTime GeneratedAt { get; set; }
}

public class KpiCardDto
{
    public string Label { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public string? Format { get; set; }  // "currency", "number", "percentage"
    public decimal? Change { get; set; }  // Percentage change from previous period
    public string? Trend { get; set; }    // "up", "down", "stable"
}

public class TopProductDto
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductNameMalayalam { get; set; }
    public decimal TotalQuantity { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public int OrderCount { get; set; }
}

public class SalesmanIncentiveSummaryDto
{
    public Guid SalesmanId { get; set; }
    public string SalesmanName { get; set; } = string.Empty;
    public decimal TotalSales { get; set; }
    public decimal TotalIncentive { get; set; }
    public int OrderCount { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Performance DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class RoutePerformanceQueryDto
{
    public Guid? RouteId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}

public class RoutePerformanceResponseDto
{
    public List<RoutePerformanceDto> Routes { get; set; } = [];
    public RoutePerformanceSummaryDto Overall { get; set; } = new();
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public DateTime GeneratedAt { get; set; }
}

public class RoutePerformanceDto
{
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public decimal TotalQuantity { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
    public int ActiveCustomerCount { get; set; }
    public int SalesmanCount { get; set; }
}

public class RoutePerformanceSummaryDto
{
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
    public int TotalOrders { get; set; }
    public int TotalRoutes { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Performance DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class ProductPerformanceQueryDto
{
    public Guid? ProductGroupId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public int? Limit { get; set; }
    public string? SortBy { get; set; }  // "sales", "margin", "quantity"
}

public class ProductPerformanceResponseDto
{
    public List<ProductPerformanceDto> Products { get; set; } = [];
    public ProductPerformanceSummaryDto Summary { get; set; } = new();
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public DateTime GeneratedAt { get; set; }
}

public class ProductPerformanceDto
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductNameMalayalam { get; set; }
    public string ProductGroupName { get; set; } = string.Empty;
    public string UnitSymbol { get; set; } = string.Empty;
    public decimal TotalQuantity { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
    public int OrderCount { get; set; }
    public decimal AveragePrice { get; set; }
}

public class ProductPerformanceSummaryDto
{
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
    public int TotalProducts { get; set; }
    public int TotalOrders { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profitability Trend DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class ProfitabilityTrendQueryDto
{
    public string Period { get; set; } = "daily";  // daily, weekly, monthly
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public Guid? RouteId { get; set; }
    public Guid? ProductGroupId { get; set; }
}

public class ProfitabilityTrendResponseDto
{
    public List<TrendDataPointDto> DataPoints { get; set; } = [];
    public TrendSummaryDto Summary { get; set; } = new();
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public DateTime GeneratedAt { get; set; }
}

public class TrendDataPointDto
{
    public DateTime Date { get; set; }
    public string PeriodLabel { get; set; } = string.Empty;
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
    public int OrderCount { get; set; }
}

public class TrendSummaryDto
{
    public decimal AverageDailySales { get; set; }
    public decimal AverageMarginPercentage { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public int TotalOrders { get; set; }
    public int TotalDays { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Period Comparison DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class PeriodComparisonQueryDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public bool CompareWithPrevious { get; set; } = true;
    public Guid? RouteId { get; set; }
}

public class PeriodComparisonResponseDto
{
    public PeriodDataDto CurrentPeriod { get; set; } = new();
    public PeriodDataDto? PreviousPeriod { get; set; }
    public ComparisonSummaryDto Comparison { get; set; } = new();
    public DateTime GeneratedAt { get; set; }
}

public class PeriodDataDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
    public int OrderCount { get; set; }
    public int CustomerCount { get; set; }
    public int RouteCount { get; set; }
}

public class ComparisonSummaryDto
{
    public decimal SalesChange { get; set; }  // Absolute change
    public decimal SalesChangePercentage { get; set; }
    public decimal MarginChange { get; set; }  // Percentage point change
    public decimal OrderCountChange { get; set; }
    public string Trend { get; set; } = "stable";  // "improving", "declining", "stable"
}