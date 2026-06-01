using Microsoft.EntityFrameworkCore;
using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Common;
using FMCG.Distribution.Application.Common.Interfaces;

namespace FMCG.Distribution.Infrastructure.Persistence;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : DbContext(options), IApplicationDbContext
{
    public DbSet<User> Users { get; set; }
    public DbSet<Route> Routes { get; set; }
    public DbSet<Customer> Customers { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<ProductGroup> ProductGroups { get; set; }
    public DbSet<ProductUnit> ProductUnits { get; set; }
    public DbSet<ProductUnitPrice> ProductUnitPrices { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }
    public DbSet<BasePrice> BasePrices { get; set; }
    public DbSet<PricingAuditLog> PricingAuditLogs { get; set; }
    public DbSet<DailyClosure> DailyClosures { get; set; }
    public DbSet<Outstanding> Outstandings { get; set; }
    public DbSet<SettlementPayment> SettlementPayments { get; set; }
    public DbSet<ProductIncentive> ProductIncentives { get; set; }
    public DbSet<RouteExecution> RouteExecutions { get; set; }
    public DbSet<CustomerVisit> CustomerVisits { get; set; }
    public DbSet<RouteAssignment> RouteAssignments => Set<RouteAssignment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.FullName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Role).IsRequired().HasConversion<int>();
            entity.Property(e => e.IsActive).IsRequired();
            entity.Property(e => e.RefreshToken).HasMaxLength(500);
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // Route configuration
        modelBuilder.Entity<Route>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.SequenceOrder).IsRequired();
            entity.Property(e => e.IsActive).IsRequired();
            entity.HasQueryFilter(e => !e.IsDeleted);

            // Relationship with User (Salesman)
            entity.HasOne(e => e.AssignedSalesman)
                  .WithMany(u => u.AssignedRoutes)
                  .HasForeignKey(e => e.AssignedSalesmanId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Customer configuration
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.NameEnglish).IsRequired().HasMaxLength(200);
            entity.Property(e => e.NameMalayalam).HasMaxLength(200);
            entity.Property(e => e.PhoneNumber).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.SequenceOrder).IsRequired();
            entity.Property(e => e.IsActive).IsRequired();
            entity.HasQueryFilter(e => !e.IsDeleted);

            // Index for Malayalam search
            entity.HasIndex(e => e.NameMalayalam);
            entity.HasIndex(e => new { e.RouteId, e.SequenceOrder });

            // Relationship with Route
            entity.HasOne(e => e.Route)
                  .WithMany(r => r.Customers)
                  .HasForeignKey(e => e.RouteId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ProductGroup configuration
        modelBuilder.Entity<ProductGroup>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.IsActive).IsRequired();
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        // ProductUnit configuration
        modelBuilder.Entity<ProductUnit>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Symbol).HasMaxLength(20);
            entity.Property(e => e.IsActive).IsRequired();
            entity.HasQueryFilter(e => !e.IsDeleted);
        });


        // ProductUnitPrice configuration
        modelBuilder.Entity<ProductUnitPrice>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UnitSize).HasPrecision(18, 3);
            entity.Property(e => e.SalePrice).HasPrecision(18, 2);
            entity.Property(e => e.SalePrice2).HasPrecision(18, 2);
            entity.Property(e => e.SalePrice3).HasPrecision(18, 2);
            entity.Property(e => e.SalePrice4).HasPrecision(18, 2);
            entity.Property(e => e.PurchaseRate).HasPrecision(18, 2);
            entity.Property(e => e.LandingCost).HasPrecision(18, 2);
            entity.Property(e => e.MRP).HasPrecision(18, 2);
            entity.Property(e => e.MOP).HasPrecision(18, 2);
            entity.Property(e => e.Discount1).HasPrecision(18, 2);
            entity.Property(e => e.Discount2).HasPrecision(18, 2);
            entity.Property(e => e.Discount3).HasPrecision(18, 2);
            entity.Property(e => e.Discount4).HasPrecision(18, 2);
            entity.Property(e => e.VAT).HasPrecision(18, 2);
            entity.Property(e => e.FloodCost).HasPrecision(18, 2);
            entity.Property(e => e.IsActive).IsRequired();
            entity.Property(e => e.IsDefault).IsRequired();
            entity.HasQueryFilter(e => !e.IsDeleted);

            // Relationships
            entity.HasOne(e => e.Product)
                .WithMany(p => p.UnitPrices)
                .HasForeignKey(e => e.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.ProductUnit)
                .WithMany()
                .HasForeignKey(e => e.ProductUnitId)
                .OnDelete(DeleteBehavior.Restrict);

            // Indexes
            entity.HasIndex(e => new { e.ProductId, e.ProductUnitId });
            entity.HasIndex(e => e.IsDefault);
        });
        // Product configuration
        // Product configuration
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.NameEnglish).IsRequired().HasMaxLength(200);
            entity.Property(e => e.NameMalayalam).HasMaxLength(200);
            entity.Property(e => e.BasePrice).HasPrecision(18, 2);
            entity.Property(e => e.IsActive).IsRequired();
            entity.HasQueryFilter(e => !e.IsDeleted);

            // Index for Malayalam search
            entity.HasIndex(e => e.NameMalayalam);

            // Relationships
            entity.HasOne(e => e.ProductGroup)
                  .WithMany(g => g.Products)
                  .HasForeignKey(e => e.ProductGroupId)
                  .OnDelete(DeleteBehavior.Restrict);

            // CHANGE ProductUnit to DefaultUnit
            entity.HasOne(e => e.DefaultUnit)
                  .WithMany(u => u.Products)
                  .HasForeignKey(e => e.DefaultUnitId)  // ← CHANGE ProductUnitId to DefaultUnitId
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Order configuration
        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.OrderNumber).IsRequired().HasMaxLength(50);
            entity.HasIndex(e => e.OrderNumber).IsUnique();
            entity.Property(e => e.CustomerId).IsRequired();
            entity.Property(e => e.RouteId).IsRequired();
            entity.Property(e => e.SalesmanId).IsRequired();
            entity.Property(e => e.OrderDate).IsRequired();
            entity.Property(e => e.Status).IsRequired().HasConversion<int>();
            entity.Property(e => e.Remarks).HasMaxLength(1000);
            entity.Property(e => e.ModifiedBy).HasMaxLength(100);
            entity.Property(e => e.IsLocked).IsRequired();
            entity.Property(e => e.SettlementStatus).IsRequired().HasConversion<int>();
            entity.Property(e => e.ExpectedPaymentAmount).HasPrecision(18, 2);
            entity.HasQueryFilter(e => !e.IsDeleted);

            // Indexes for performance
            entity.HasIndex(e => e.CustomerId);
            entity.HasIndex(e => e.RouteId);
            entity.HasIndex(e => e.SalesmanId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.IsLocked);
            entity.HasIndex(e => new { e.RouteId, e.Status });
            entity.HasIndex(e => new { e.CustomerId, e.OrderDate });

            // Relationships
            entity.HasOne(e => e.Customer)
                  .WithMany()
                  .HasForeignKey(e => e.CustomerId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Route)
                  .WithMany()
                  .HasForeignKey(e => e.RouteId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Salesman)
                  .WithMany()
                  .HasForeignKey(e => e.SalesmanId)
                  .OnDelete(DeleteBehavior.Restrict);

            // Relationship with CustomerVisit
            entity.HasOne(o => o.CustomerVisit)
                  .WithMany()
                  .HasForeignKey(o => o.CustomerVisitId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // RouteAssignment
        modelBuilder.Entity<RouteAssignment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Notes).HasMaxLength(500);
            entity.Property(e => e.IsOverride).HasDefaultValue(true);
            entity.Property(e => e.IsDeleted).HasDefaultValue(false);

            entity.HasOne(e => e.Route)
                .WithMany()
                .HasForeignKey(e => e.RouteId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Salesman)
                .WithMany()
                .HasForeignKey(e => e.SalesmanId)
                .OnDelete(DeleteBehavior.Restrict);

            // Unique: one assignment per route per date (ignoring soft-deleted)
            entity.HasIndex(e => new { e.RouteId, e.AssignmentDate })
                .IsUnique()
                .HasFilter("\"IsDeleted\" = false");
        });

        // OrderItem configuration
        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.OrderId).IsRequired();
            entity.Property(e => e.ProductId).IsRequired();
            entity.Property(e => e.Quantity).HasPrecision(18, 3);
            entity.Property(e => e.UnitId).IsRequired();
            entity.HasQueryFilter(e => !e.IsDeleted);

            // Indexes
            entity.HasIndex(e => e.OrderId);
            entity.HasIndex(e => e.ProductId);

            // Relationships
            entity.HasOne(e => e.Order)
                  .WithMany(o => o.Items)
                  .HasForeignKey(e => e.OrderId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Product)
                  .WithMany()
                  .HasForeignKey(e => e.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Unit)
                  .WithMany()
                  .HasForeignKey(e => e.UnitId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // BasePrice configuration
        modelBuilder.Entity<BasePrice>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Price).HasPrecision(18, 2);
            entity.Property(e => e.EffectiveDate).IsRequired();
            entity.Property(e => e.IsActive).IsRequired();
            entity.Property(e => e.Reason).HasMaxLength(500);
            entity.HasQueryFilter(e => !e.IsDeleted);

            // Indexes
            entity.HasIndex(e => e.ProductId);
            entity.HasIndex(e => new { e.ProductId, e.IsActive });
            entity.HasIndex(e => e.EffectiveDate);

            // Relationship with Product
            entity.HasOne(e => e.Product)
                  .WithMany()
                  .HasForeignKey(e => e.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // PricingAuditLog configuration
        modelBuilder.Entity<PricingAuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.OldPrice).HasPrecision(18, 2);
            entity.Property(e => e.NewPrice).HasPrecision(18, 2);
            entity.Property(e => e.Action).IsRequired().HasConversion<int>();
            entity.Property(e => e.Reason).HasMaxLength(500);
            entity.Property(e => e.ModifiedBy).IsRequired().HasMaxLength(100);
            entity.HasQueryFilter(e => !e.IsDeleted);

            // Indexes
            entity.HasIndex(e => e.ProductId);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.Action);

            // Relationship with Product
            entity.HasOne(e => e.Product)
                  .WithMany()
                  .HasForeignKey(e => e.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // DailyClosure configuration
        modelBuilder.Entity<DailyClosure>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ClosureDate).IsRequired();
            entity.Property(e => e.ClosedAt).IsRequired();
            entity.Property(e => e.ClosedByUserId).IsRequired();
            entity.Property(e => e.TotalSales).HasPrecision(18, 2);
            entity.Property(e => e.TotalOutstanding).HasPrecision(18, 2);
            entity.Property(e => e.ExpectedCash).HasPrecision(18, 2);
            entity.Property(e => e.IsActive).IsRequired();
            entity.Property(e => e.Notes).HasMaxLength(500);
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.HasIndex(e => e.ClosureDate);
            entity.HasIndex(e => e.ClosedByUserId);

            entity.HasOne(e => e.ClosedByUser)
                  .WithMany()
                  .HasForeignKey(e => e.ClosedByUserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Outstanding configuration
        modelBuilder.Entity<Outstanding>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CustomerId).IsRequired();
            entity.Property(e => e.OutstandingAmount).HasPrecision(18, 2);
            entity.Property(e => e.SettlementStatus).IsRequired().HasConversion<int>();
            entity.Property(e => e.SettlementReference).HasMaxLength(100);
            entity.Property(e => e.Remarks).HasMaxLength(500);
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.HasIndex(e => e.CustomerId);
            entity.HasIndex(e => e.OrderId);
            entity.HasIndex(e => e.SettlementStatus);

            entity.HasOne(e => e.Customer)
                  .WithMany()
                  .HasForeignKey(e => e.CustomerId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Order)
                  .WithMany()
                  .HasForeignKey(e => e.OrderId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // SettlementPayment configuration
        modelBuilder.Entity<SettlementPayment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CustomerId).IsRequired();
            entity.Property(e => e.Amount).HasPrecision(18, 2);
            entity.Property(e => e.PaymentDate).IsRequired();
            entity.Property(e => e.PaymentReference).HasMaxLength(100);
            entity.Property(e => e.PaymentMode).HasMaxLength(50);
            entity.Property(e => e.Remarks).HasMaxLength(500);
            entity.Property(e => e.RecordedByUserId).IsRequired();
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.HasIndex(e => e.CustomerId);
            entity.HasIndex(e => e.PaymentDate);
            entity.HasIndex(e => e.RecordedByUserId);

            entity.HasOne(e => e.Customer)
                  .WithMany()
                  .HasForeignKey(e => e.CustomerId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.RecordedByUser)
                  .WithMany()
                  .HasForeignKey(e => e.RecordedByUserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ProductIncentive configuration
        modelBuilder.Entity<ProductIncentive>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ProductId).IsRequired();
            entity.Property(e => e.IncentiveValue).HasPrecision(18, 2);
            entity.Property(e => e.IncentiveType).IsRequired().HasConversion<int>();
            entity.Property(e => e.EffectiveDate).IsRequired();
            entity.Property(e => e.IsActive).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.HasIndex(e => e.ProductId);
            entity.HasIndex(e => e.EffectiveDate);
            entity.HasIndex(e => new { e.ProductId, e.IsActive });
            entity.HasIndex(e => new { e.ProductId, e.EffectiveDate });

            entity.HasOne(e => e.Product)
                  .WithMany()
                  .HasForeignKey(e => e.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // RouteExecution configuration
        modelBuilder.Entity<RouteExecution>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ExecutionDate).IsRequired();
            entity.Property(e => e.Status).IsRequired().HasConversion<int>();
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.HasIndex(e => new { e.RouteId, e.ExecutionDate });
            entity.HasIndex(e => e.SalesmanId);
            entity.HasIndex(e => e.Status);

            entity.HasOne(e => e.Route)
                  .WithMany()
                  .HasForeignKey(e => e.RouteId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Salesman)
                  .WithMany()
                  .HasForeignKey(e => e.SalesmanId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // CustomerVisit configuration
        modelBuilder.Entity<CustomerVisit>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SequenceOrder).IsRequired();
            entity.Property(e => e.Status).IsRequired().HasConversion<int>();
            entity.Property(e => e.SkipReason).HasMaxLength(500);
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.HasIndex(e => e.RouteExecutionId);
            entity.HasIndex(e => e.CustomerId);
            entity.HasIndex(e => new { e.RouteExecutionId, e.SequenceOrder });

            entity.HasOne(e => e.RouteExecution)
                  .WithMany(r => r.Visits)
                  .HasForeignKey(e => e.RouteExecutionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Customer)
                  .WithMany()
                  .HasForeignKey(e => e.CustomerId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Order)
                  .WithMany()
                  .HasForeignKey(e => e.OrderId)
                  .OnDelete(DeleteBehavior.Restrict);
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries<BaseEntity>();
        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = DateTime.UtcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}