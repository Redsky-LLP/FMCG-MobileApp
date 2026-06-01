using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

public class Customer : BaseEntity
{
    public string NameEnglish { get; set; } = string.Empty;
    public string NameMalayalam { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public Guid RouteId { get; set; }
    public int SequenceOrder { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public virtual Route? Route { get; set; }
}