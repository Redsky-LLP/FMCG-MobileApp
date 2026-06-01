using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class ProductUnitPrice : BaseEntity
{
    public Guid ProductId { get; set; }
    public Guid ProductUnitId { get; set; }

    // Unit measurement
    public decimal UnitSize { get; set; }        // e.g., 50 (for 50kg), 25, 10
    public string? UnitSizeLabel { get; set; }   // e.g., "kg", "bag", "vadi"

    // Pricing
    public decimal SalePrice { get; set; }       // Primary sale price
    public decimal SalePrice2 { get; set; }      // Secondary price (e.g., wholesale)
    public decimal SalePrice3 { get; set; }      // Tertiary price (e.g., bulk)
    public decimal SalePrice4 { get; set; }      // Quaternary price

    // Cost prices
    public decimal PurchaseRate { get; set; }    // Purchase cost per unit
    public decimal LandingCost { get; set; }     // Landed cost (including freight)

    // Retail prices
    public decimal MRP { get; set; }              // Maximum Retail Price
    public decimal MOP { get; set; }              // Minimum Order Price

    // Discounts
    public decimal Discount1 { get; set; }        // Trade discount
    public decimal Discount2 { get; set; }        // Cash discount
    public decimal Discount3 { get; set; }        // Volume discount
    public decimal Discount4 { get; set; }        // Special discount

    // Taxes & additional costs
    public decimal VAT { get; set; }              // VAT percentage
    public decimal FloodCost { get; set; }        // Flood Cess / additional tax

    // Flags
    public bool IsDefault { get; set; }           // Primary selling unit
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public virtual Product? Product { get; set; }
    public virtual ProductUnit? ProductUnit { get; set; }
}