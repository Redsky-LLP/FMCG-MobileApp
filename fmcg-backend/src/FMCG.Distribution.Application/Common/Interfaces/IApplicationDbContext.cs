// PATH: src/FMCG.Distribution.Application/Common/Interfaces/IApplicationDbContext.cs
// CHANGE: Added Task<long> NextOrderSequenceAsync() for atomic order number generation

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using FMCG.Distribution.Domain.Entities;

namespace FMCG.Distribution.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<Route> Routes { get; }
    DbSet<Customer> Customers { get; }
    DbSet<Product> Products { get; }
    DbSet<ProductGroup> ProductGroups { get; }
    DbSet<ProductUnit> ProductUnits { get; }
    DbSet<ProductUnitPrice> ProductUnitPrices { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<BasePrice> BasePrices { get; }
    DbSet<PricingAuditLog> PricingAuditLogs { get; }
    DbSet<DailyClosure> DailyClosures { get; }
    DbSet<Outstanding> Outstandings { get; }
    DbSet<SettlementPayment> SettlementPayments { get; }
    DbSet<ProductIncentive> ProductIncentives { get; }
    DbSet<RouteExecution> RouteExecutions { get; }
    DbSet<RouteAssignment> RouteAssignments { get; }
    DbSet<CustomerVisit> CustomerVisits { get; }
    DbSet<UserSession> UserSessions { get; }

    ChangeTracker ChangeTracker { get; }
    EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the next value from the PostgreSQL order_number_seq sequence.
    /// This is atomic and safe for concurrent requests — no duplicate keys possible.
    /// </summary>
    Task<long> NextOrderSequenceAsync(CancellationToken cancellationToken = default);
}