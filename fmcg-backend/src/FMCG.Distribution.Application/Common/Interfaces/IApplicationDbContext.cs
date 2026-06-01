// PATH: src/FMCG.Distribution.Application/Common/Interfaces/IApplicationDbContext.cs

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
    DbSet<ProductUnitPrice> ProductUnitPrices { get; }  // ← ADD THIS
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

    ChangeTracker ChangeTracker { get; }
    EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}