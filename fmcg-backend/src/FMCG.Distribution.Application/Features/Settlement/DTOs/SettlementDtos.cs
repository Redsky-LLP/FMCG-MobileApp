namespace FMCG.Distribution.Application.Features.Settlement.DTOs;

public class ExpectedCashDto
{
    public decimal TotalSales { get; set; }
    public decimal TotalOutstanding { get; set; }
    public decimal ExpectedCash { get; set; }
    public int OrderCount { get; set; }
    public int CustomerCount { get; set; }
    public DateTime CalculatedAt { get; set; }
}

public class ClosureValidationDto
{
    public bool IsValid { get; set; }
    public List<string> ValidationErrors { get; set; } = new();
    public ExpectedCashDto? SettlementSummary { get; set; }
}

public class OutstandingSummaryDto
{
    public decimal TotalOutstanding { get; set; }
    public int CustomersWithOutstanding { get; set; }
    public List<OutstandingCustomerDto> Customers { get; set; } = new();
}

public class OutstandingCustomerDto
{
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerNameMalayalam { get; set; }
    public decimal OutstandingAmount { get; set; }
    public int OpenOrdersCount { get; set; }
}

public class DailyClosureResultDto
{
    public Guid ClosureId { get; set; }
    public DateTime ClosureDate { get; set; }
    public DateTime ClosedAt { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalOutstanding { get; set; }
    public decimal ExpectedCash { get; set; }
    public bool Success { get; set; }
    public string? Message { get; set; }

    // ── Report download URLs (populated after closure) ─────────────────────
    // Relative URLs the frontend can GET to download PDFs.
    // Null if report generation was skipped or failed (non-blocking).
    public string? LoadingSheetUrl { get; set; }
    public string? BillingSheetUrl { get; set; }
    // ─────────────────────────────────────────────────────────────────────
}