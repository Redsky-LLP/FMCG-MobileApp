namespace FMCG.Distribution.Application.Features.Reports.DTOs;

// ─────────────────────────────────────────────────────────────────────────────
// Loading Sheet DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class LoadingSheetItemDto
{
    public string ProductName { get; set; } = string.Empty;
    public string? ProductNameMalayalam { get; set; }
    public string UnitSymbol { get; set; } = string.Empty;
    public decimal TotalQuantity { get; set; }
    public int LoadingPriority { get; set; } = 99;      // For sorting
    public string UnitTypeLabel { get; set; } = string.Empty;  // "BAGS", "BOXES", "TINS"

    // ── Split quantities for display ──
    public int? QuantityBags { get; set; }
    public int? QuantityBoxes { get; set; }
    public int? QuantityTins { get; set; }
}

public class LoadingSheetStopDto
{
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerNameMalayalam { get; set; }
    public int SequenceOrder { get; set; }           // Delivery order (1,2,3...)
    public int LoadingPosition { get; set; }         // Loading order (N...3,2,1) - REVERSED
    public bool IsFirstDelivery { get; set; }        // True if SequenceOrder == 1
    public bool IsLastDelivery { get; set; }         // True if last in delivery order
    public VisitStatus VisitStatus { get; set; }
    public List<LoadingSheetItemDto> Items { get; set; } = new();
    public decimal StopTotalQuantity { get; set; }
}

public class LoadingSheetRouteGroupDto
{
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public List<LoadingSheetStopDto> Stops { get; set; } = new();
    public decimal RouteTotalQuantity { get; set; }
    public int TotalStops { get; set; }
    public int TotalOrders { get; set; }
}

public class LoadingSheetDataDto
{
    public DateTime ReportDate { get; set; }
    public DateTime GeneratedAt { get; set; }
    public List<LoadingSheetRouteGroupDto> Routes { get; set; } = new();
    public decimal GrandTotalQuantity { get; set; }
    public int TotalRoutes { get; set; }
    public int TotalOrders { get; set; }
    public int TotalStops { get; set; }
    public string LoadingNote { get; set; } = string.Empty;  // Instructions for loader
}


// ─────────────────────────────────────────────────────────────────────────────
// Billing Sheet DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class BillingSheetItemDto
{
    public string ProductName { get; set; } = string.Empty;
    public string? ProductNameMalayalam { get; set; }
    public string UnitSymbol { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal SellingPrice { get; set; }
    public decimal LineTotal { get; set; }
    public decimal BasePriceAtTime { get; set; }
    public decimal Variance { get; set; }
    public bool IsProfitable => Variance > 0;
}

public class BillingSheetOrderDto
{
    public Guid OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerNameMalayalam { get; set; }
    public DateTime OrderDate { get; set; }
    public List<BillingSheetItemDto> Items { get; set; } = [];
    public decimal OrderTotal { get; set; }
    public decimal OrderVariance { get; set; }
}

public class BillingSheetRouteGroupDto
{
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public List<BillingSheetOrderDto> Orders { get; set; } = [];
    public decimal RouteTotalSales { get; set; }
    public decimal RouteTotalVariance { get; set; }
}

public class BillingSheetDataDto
{
    public DateTime ReportDate { get; set; }
    public DateTime GeneratedAt { get; set; }
    public List<BillingSheetRouteGroupDto> Routes { get; set; } = [];
    public decimal GrandTotalSales { get; set; }
    public decimal GrandTotalVariance { get; set; }
    public int TotalOrders { get; set; }
    public int TotalRoutes { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Summary Report DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class RouteSummaryItemDto
{
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public decimal TotalQuantity { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
}

public class RouteSummaryReportDataDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public DateTime GeneratedAt { get; set; }
    public List<RouteSummaryItemDto> Routes { get; set; } = [];
    public decimal OverallSales { get; set; }
    public decimal OverallVariance { get; set; }
    public decimal OverallMarginPercentage { get; set; }
    public int TotalOrderCount { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Summary Report DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class ProductSummaryItemDto
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductNameMalayalam { get; set; }
    public string ProductGroupName { get; set; } = string.Empty;
    public string UnitSymbol { get; set; } = string.Empty;
    public decimal TotalQuantity { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public int OrderCount { get; set; }
    public decimal MarginPercentage { get; set; }
}

public class ProductSummaryReportDataDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public DateTime GeneratedAt { get; set; }
    public List<ProductSummaryItemDto> Products { get; set; } = [];
    public decimal OverallSales { get; set; }
    public decimal OverallVariance { get; set; }
    public decimal OverallMarginPercentage { get; set; }
    public int TotalProductCount { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily Summary Report DTOs
// ─────────────────────────────────────────────────────────────────────────────

public class DailySummaryItemDto
{
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public decimal TotalQuantity { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
}

public class DailySummaryReportDataDto
{
    public DateTime ReportDate { get; set; }
    public DateTime GeneratedAt { get; set; }
    public List<DailySummaryItemDto> Routes { get; set; } = [];
    public decimal TotalSales { get; set; }
    public decimal TotalVariance { get; set; }
    public int TotalOrders { get; set; }
    public int TotalRoutes { get; set; }
    public bool IsDayClosed { get; set; }
    public DateTime? ClosedAt { get; set; }
}