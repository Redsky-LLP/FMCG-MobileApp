using QuestPDF;
using QuestPDF.Infrastructure;
using System.Text;
using System.Reflection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using FluentValidation;
using MediatR;
using FMCG.Distribution.Application.Common.Interfaces;
using FMCG.Distribution.Infrastructure.Persistence;
using FMCG.Distribution.Infrastructure.Services;

// QuestPDF License Configuration (Community License for MVP)
QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// ============================================================
// 1. Database Configuration
// ============================================================
var dbProvider = builder.Configuration.GetValue<string>("DatabaseSettings:Provider");
var usePostgres = dbProvider?.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase) == true;

Console.WriteLine($"[STARTUP] DatabaseSettings:Provider = '{dbProvider}'");
Console.WriteLine($"[STARTUP] usePostgres = {usePostgres}");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (usePostgres)
    {
        var connectionString = builder.Configuration.GetConnectionString("PostgresConnection");

        // Log connection string with password hidden
        var safeCs = connectionString == null ? "NULL" :
            System.Text.RegularExpressions.Regex.Replace(
                connectionString, @"Password=[^;]+", "Password=***");
        Console.WriteLine($"[STARTUP] PostgresConnection = '{safeCs}'");

        options.UseNpgsql(connectionString, x => x.MigrationsAssembly("FMCG.Distribution.Infrastructure"));
    }
    else
    {
        var connectionString = builder.Configuration.GetConnectionString("SqlServerConnection");
        Console.WriteLine($"[STARTUP] Using SQL Server");
        options.UseSqlServer(connectionString, x => x.MigrationsAssembly("FMCG.Distribution.Infrastructure"));
    }
});

// Fix PostgreSQL DateTime timezone issue
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

// ============================================================
// 2. Register Interfaces
// ============================================================
builder.Services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<ISettlementService, SettlementService>();
builder.Services.AddScoped<IIncentiveService, IncentiveService>();

// ============================================================
// 3. MediatR - Scan Application layer for handlers
// ============================================================
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(typeof(IApplicationDbContext).Assembly));

// ============================================================
// 4. FluentValidation
// ============================================================
builder.Services.AddValidatorsFromAssembly(typeof(IApplicationDbContext).Assembly);

// ============================================================
// 5. JWT Authentication
// ============================================================
var jwtKey = builder.Configuration["Jwt:Key"] ?? "FMCG_Distribution_SuperSecretKey_32Chars_2024!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "FMCG.Distribution";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "FMCG.Distribution.Frontend";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// ============================================================
// 6. CORS Configuration
// ============================================================
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "https://localhost:5173", "http://localhost:3000"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ============================================================
// 7. Controllers + API Explorer
// ============================================================
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ============================================================
// 8. Swagger with JWT Support and Custom Schema IDs to fix duplicate class names
// ============================================================
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "FMCG Distribution API",
        Version = "v1",
        Description = "Route-based FMCG Sales Governance Platform API"
    });

    c.CustomSchemaIds(type => type.FullName?.Replace("+", "."));

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer' followed by your token. Example: Bearer your-jwt-token"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ============================================================
// 9. Build App
// ============================================================
var app = builder.Build();

// ============================================================
// 10. Configure Pipeline
// ============================================================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ============================================================
// 11. Database Connection Check & Seed Data
// ============================================================
Console.WriteLine("[DB] Starting database connection check...");
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    // Log the actual connection string being used at runtime
    try
    {
        var runtimeCs = dbContext.Database.GetConnectionString() ?? "NULL";
        var safeRuntimeCs = System.Text.RegularExpressions.Regex.Replace(
            runtimeCs, @"Password=[^;]+", "Password=***");
        Console.WriteLine($"[DB] Runtime connection string: {safeRuntimeCs}");
    }
    catch (Exception csEx)
    {
        Console.WriteLine($"[DB] Could not read runtime connection string: {csEx.Message}");
    }

    try
    {
        Console.WriteLine("[DB] Calling CanConnect()...");
        var canConnect = dbContext.Database.CanConnect();
        Console.WriteLine($"[DB] CanConnect result: {canConnect}");
        Console.WriteLine($"Database connection: {(canConnect ? "✓ OK" : "✗ FAILED")}");

        if (canConnect)
        {
            Console.WriteLine("[DB] Running DbInitializer...");
            await DbInitializer.InitializeAsync(dbContext);
            Console.WriteLine("Database seeded successfully.");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database connection: ✗ FAILED");
        Console.WriteLine($"[DB] ERROR TYPE:  {ex.GetType().FullName}");
        Console.WriteLine($"[DB] ERROR MSG:   {ex.Message}");
        Console.WriteLine($"[DB] INNER 1:     {ex.InnerException?.Message}");
        Console.WriteLine($"[DB] INNER 2:     {ex.InnerException?.InnerException?.Message}");
        Console.WriteLine($"[DB] STACK:\n{ex.StackTrace}");
    }
}
Console.WriteLine("[DB] Database check complete.");

// ============================================================
// 12. Startup Info
// ============================================================
Console.WriteLine("=".PadRight(60, '='));
Console.WriteLine("FMCG Distribution API Started");
Console.WriteLine($"Environment: {app.Environment.EnvironmentName}");
Console.WriteLine($"Database Provider: {(usePostgres ? "PostgreSQL" : "SQL Server")}");
Console.WriteLine("=".PadRight(60, '='));

await app.RunAsync();