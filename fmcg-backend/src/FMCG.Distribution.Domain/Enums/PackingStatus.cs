// PATH: src/FMCG.Distribution.Domain/Enums/PackingStatus.cs
// NEW FILE — tracks warehouse packing state per order

namespace FMCG.Distribution.Domain.Enums;

public enum PackingStatus
{
    Pending = 0,   // default — order submitted, not yet packed
    Packed = 1,   // all items packed and ready for loading
    PartiallyPacked = 2,   // some items packed (e.g. stock shortage)
}