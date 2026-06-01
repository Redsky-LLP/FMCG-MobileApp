using MediatR;
using FMCG.Distribution.Application.Common;

namespace FMCG.Distribution.Application.Features.Analytics.Queries;

public class GetOrderMarginQuery : IRequest<Result<OrderMarginDto>>
{
    public Guid OrderId { get; set; }
    public Guid? UserId { get; set; }
    public bool IsAdmin { get; set; }
}

public class OrderMarginDto
{
    public Guid OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public Guid RouteId { get; set; }
    public string RouteName { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal TotalSales { get; set; }
    public decimal TotalBaseCost { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal MarginPercentage { get; set; }
    public List<OrderItemMarginDto> Items { get; set; } = [];
}

public class OrderItemMarginDto
{
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal SellingPrice { get; set; }
    public decimal BasePriceAtTime { get; set; }
    public decimal Variance { get; set; }
    public bool IsProfitable => Variance > 0;
}