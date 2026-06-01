using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FMCG.Distribution.Domain.Enums;

public enum ExecutionType
{
    Delivery = 1,      // Default - only visit customers with submitted orders
    OrderTaking = 2    // Visit all customers to take new orders
}