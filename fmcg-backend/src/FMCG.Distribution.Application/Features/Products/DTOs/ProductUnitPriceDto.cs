using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FMCG.Distribution.Application.Features.Products.DTOs;

public class ProductUnitPriceDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid ProductUnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public string UnitSymbol { get; set; } = string.Empty;
    public decimal UnitSize { get; set; }
    public string? UnitSizeLabel { get; set; }

    // Prices
    public decimal SalePrice { get; set; }
    public decimal SalePrice2 { get; set; }
    public decimal SalePrice3 { get; set; }
    public decimal SalePrice4 { get; set; }
    public decimal PurchaseRate { get; set; }
    public decimal LandingCost { get; set; }
    public decimal MRP { get; set; }
    public decimal MOP { get; set; }

    // Discounts & Taxes
    public decimal Discount1 { get; set; }
    public decimal Discount2 { get; set; }
    public decimal Discount3 { get; set; }
    public decimal Discount4 { get; set; }
    public decimal VAT { get; set; }
    public decimal FloodCost { get; set; }

    public bool IsDefault { get; set; }
    public bool IsActive { get; set; }
}

public class CreateProductUnitPriceDto
{
    public Guid ProductId { get; set; }
    public Guid ProductUnitId { get; set; }
    public decimal UnitSize { get; set; }
    public string? UnitSizeLabel { get; set; }
    public decimal SalePrice { get; set; }
    public decimal SalePrice2 { get; set; }
    public decimal SalePrice3 { get; set; }
    public decimal SalePrice4 { get; set; }
    public decimal PurchaseRate { get; set; }
    public decimal LandingCost { get; set; }
    public decimal MRP { get; set; }
    public decimal MOP { get; set; }
    public decimal Discount1 { get; set; }
    public decimal Discount2 { get; set; }
    public decimal Discount3 { get; set; }
    public decimal Discount4 { get; set; }
    public decimal VAT { get; set; }
    public decimal FloodCost { get; set; }
    public bool IsDefault { get; set; }
}

public class UpdateProductUnitPriceDto : CreateProductUnitPriceDto
{
    public Guid Id { get; set; }
    public bool IsActive { get; set; }
}