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

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (usePostgres)
    {
        var connectionString = builder.Configuration.GetConnectionString("PostgresConnection");
        options.UseNpgsql(connectionString, x => x.MigrationsAssembly("FMCG.Distribution.Infrastructure"));
    }
    else
    {
        var connectionString = builder.Configuration.GetConnectionString("SqlServerConnection");
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

    // FIX: Handle duplicate class names in different namespaces
    // This resolves the conflict between:
    // - FMCG.Distribution.Application.Features.Incentives.DTOs.SalesmanIncentiveSummaryDto
    // - FMCG.Distribution.Application.Features.Analytics.DTOs.SalesmanIncentiveSummaryDto
    c.CustomSchemaIds(type => type.FullName?.Replace("+", "."));

    // XML comments are disabled to prevent the 500 Internal Server Error
    // To enable XML comments, uncomment the lines below and ensure XML doc generation is enabled in .csproj
    // var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    // var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    // if (File.Exists(xmlPath))
    // {
    //     c.IncludeXmlComments(xmlPath);
    // }

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

// Fix PostgreSQL DateTime timezone issue
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

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
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try
    {
        var canConnect = dbContext.Database.CanConnect();
        Console.WriteLine($"Database connection: {(canConnect ? "✓ OK" : "✗ FAILED")}");

        if (canConnect)
        {
            await DbInitializer.InitializeAsync(dbContext);
            Console.WriteLine("Database seeded successfully.");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database check failed: {ex.GetType().Name}");
        Console.WriteLine($"Message: {ex.Message}");
        Console.WriteLine($"Inner: {ex.InnerException?.Message}");
        Console.WriteLine($"Stack: {ex.StackTrace}");
    }
}

// ============================================================
// 12. Startup Info
// ============================================================
Console.WriteLine("=".PadRight(60, '='));
Console.WriteLine("FMCG Distribution API Started");
Console.WriteLine($"Environment: {app.Environment.EnvironmentName}");
Console.WriteLine($"Database Provider: {(usePostgres ? "PostgreSQL" : "SQL Server")}");
Console.WriteLine("=".PadRight(60, '='));

await app.RunAsync();