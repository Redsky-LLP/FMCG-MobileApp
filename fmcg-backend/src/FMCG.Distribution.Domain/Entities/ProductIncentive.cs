using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using FMCG.Distribution.Domain.Common;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Domain.Entities;

public class ProductIncentive : BaseEntity
{
    public Guid ProductId { get; set; }
    public decimal IncentiveValue { get; set; }
    public IncentiveType IncentiveType { get; set; }
    public DateTime EffectiveDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Description { get; set; }

    // Navigation property
    public virtual Product? Product { get; set; }
}