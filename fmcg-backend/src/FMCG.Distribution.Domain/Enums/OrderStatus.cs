// PATH: src/FMCG.Distribution.Domain/Enums/OrderStatus.cs

namespace FMCG.Distribution.Domain.Enums;

public enum OrderStatus
{
    Draft = 1,
    PendingApproval = 2,   // ← ADD THIS
    Approved = 3,          // ← ADD THIS
    Packed = 4,            // ← ADD THIS
    Closed = 5
}