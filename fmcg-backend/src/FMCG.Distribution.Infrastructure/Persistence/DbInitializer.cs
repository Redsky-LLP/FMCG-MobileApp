using FMCG.Distribution.Domain.Entities;
using FMCG.Distribution.Domain.Enums;

namespace FMCG.Distribution.Infrastructure.Persistence;

public static class DbInitializer
{
    public static async Task InitializeAsync(ApplicationDbContext context)
    {
        await context.Database.EnsureCreatedAsync();

        // Seed Super Admin if not exists
        if (!context.Users.Any(u => u.Role == UserRole.SuperAdmin))
        {
            var superAdmin = new User
            {
                Id = Guid.NewGuid(),
                Email = "admin@fmcg.com",
                FullName = "Super Admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                Role = UserRole.SuperAdmin,
                IsActive = true
            };
            await context.Users.AddAsync(superAdmin);
            await context.SaveChangesAsync();
        }

        // Seed Admin if not exists
        if (!context.Users.Any(u => u.Role == UserRole.Admin))
        {
            var admin = new User
            {
                Id = Guid.NewGuid(),
                Email = "admin@distribution.com",
                FullName = "Distribution Admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                Role = UserRole.Admin,
                IsActive = true
            };
            await context.Users.AddAsync(admin);
            await context.SaveChangesAsync();
        }

        // Seed Salesman if not exists
        if (!context.Users.Any(u => u.Role == UserRole.Salesman))
        {
            var salesman = new User
            {
                Id = Guid.NewGuid(),
                Email = "salesman@fmcg.com",
                FullName = "Route Salesman",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Sales@123"),
                Role = UserRole.Salesman,
                IsActive = true
            };
            await context.Users.AddAsync(salesman);
            await context.SaveChangesAsync();
        }

        // Seed Product Groups
        await SeedProductGroupsAsync(context);

        // Seed Product Units
        await SeedProductUnitsAsync(context);
    }

    private static async Task SeedProductGroupsAsync(ApplicationDbContext context)
    {
        if (!context.ProductGroups.Any())
        {
            var defaultGroups = new[]
            {
                new ProductGroup { Id = Guid.NewGuid(), Name = "Rice", Description = "Rice products", IsActive = true },
                new ProductGroup { Id = Guid.NewGuid(), Name = "Oil", Description = "Cooking oils", IsActive = true },
                new ProductGroup { Id = Guid.NewGuid(), Name = "Pulses", Description = "Dal and pulses", IsActive = true },
                new ProductGroup { Id = Guid.NewGuid(), Name = "Salt", Description = "Salt products", IsActive = true },
                new ProductGroup { Id = Guid.NewGuid(), Name = "Sugar", Description = "Sugar products", IsActive = true },
                new ProductGroup { Id = Guid.NewGuid(), Name = "Wheat Products", Description = "Wheat flour, atta, etc.", IsActive = true },
                new ProductGroup { Id = Guid.NewGuid(), Name = "Others", Description = "Other products", IsActive = true }
            };
            await context.ProductGroups.AddRangeAsync(defaultGroups);
            await context.SaveChangesAsync();
        }
    }

    private static async Task SeedProductUnitsAsync(ApplicationDbContext context)
    {
        if (!context.ProductUnits.Any())
        {
            var defaultUnits = new[]
            {
                new ProductUnit { Id = Guid.NewGuid(), Name = "Bag", Symbol = "bag", IsActive = true },
                new ProductUnit { Id = Guid.NewGuid(), Name = "Box", Symbol = "box", IsActive = true },
                new ProductUnit { Id = Guid.NewGuid(), Name = "Carton", Symbol = "ctn", IsActive = true },
                new ProductUnit { Id = Guid.NewGuid(), Name = "Tin", Symbol = "tin", IsActive = true },
                new ProductUnit { Id = Guid.NewGuid(), Name = "Case", Symbol = "case", IsActive = true },
                new ProductUnit { Id = Guid.NewGuid(), Name = "Piece", Symbol = "pc", IsActive = true }
            };
            await context.ProductUnits.AddRangeAsync(defaultUnits);
            await context.SaveChangesAsync();
        }
    }
}