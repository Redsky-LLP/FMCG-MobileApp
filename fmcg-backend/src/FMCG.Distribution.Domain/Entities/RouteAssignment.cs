// PATH: src/FMCG.Distribution.Domain/Entities/RouteAssignment.cs
// NEW FILE — daily route assignment, overrides Route.AssignedSalesmanId for a specific date

using FMCG.Distribution.Domain.Common;

namespace FMCG.Distribution.Domain.Entities;

/// <summary>
/// Allows admin to assign (or reassign) a salesman to a route for a specific date.
/// Lookup priority: RouteAssignment for today → Route.AssignedSalesmanId (permanent fallback).
/// </summary>
public class RouteAssignment : BaseEntity
{
    public Guid RouteId { get; set; }
    public Guid SalesmanId { get; set; }
    public DateTime AssignmentDate { get; set; }    // UTC date only
    public string? Notes { get; set; }    // e.g. "Covering for Rajesh"
    public bool IsOverride { get; set; } = true; // always true for daily overrides

    // Navigation
    public virtual Route? Route { get; set; }
    public virtual User? Salesman { get; set; }
}