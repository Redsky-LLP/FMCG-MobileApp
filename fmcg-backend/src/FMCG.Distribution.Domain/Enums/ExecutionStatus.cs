namespace FMCG.Distribution.Domain.Enums;

public enum ExecutionStatus
{
    Draft = 1,
    InProgress = 2,
    Completed = 3,
    Abandoned = 4,
    OrderTaking = 5  // NEW: Separate mode for taking orders
}