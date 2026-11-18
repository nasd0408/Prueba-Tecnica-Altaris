using System.Text.Json.Serialization;
using Altairis.Api.Auth;
using Altairis.Api.Data;
using Altairis.Api.Errors;
using Altairis.Api.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    // Enums as text in JSON ("Confirmed" instead of 2): self-explanatory for the frontend and anyone
    // reading the API. Numbers are still accepted on input (e.g. DayOfWeek from the inventory form).
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    // DataAnnotations errors keep the standard ValidationProblemDetails shape ("errors" per field)
    // and also get the same "code" + "args" as business errors, so the frontend reads every error the same way.
    .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = context =>
    {
        var problem = new ValidationProblemDetails(context.ModelState) { Status = StatusCodes.Status400BadRequest };
        var error = ApiErrors.ValidationFailed(context.ModelState.Where(e => e.Value?.Errors.Count > 0).Select(e => e.Key));
        problem.Extensions["code"] = error.Code;
        problem.Extensions["args"] = error.Args;
        return new BadRequestObjectResult(problem);
    });
builder.Services.AddOpenApi();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"),
        // Retries transient SQL errors (connection drops, the container still warming up...).
        // Heads-up for later: with this on, explicit transactions must run inside
        // db.Database.CreateExecutionStrategy(), otherwise EF throws.
        sql => sql.EnableRetryOnFailure()));

// Built-in ASP.NET Core Identity: users table, password hashing, lockout and bearer tokens.
// Why not hand-rolled JWT: all of that is already solved and reviewed here. The tokens are opaque
// bearer tokens protected with Data Protection, not JWTs - fine because only this API reads them.
// If other services had to validate them, I'd move to JWT or an identity provider (Entra ID, Keycloak...).
// AddIdentityApiEndpoints registers the services + bearer scheme; the endpoints themselves are
// in AuthController (see why there).
builder.Services.AddAuthorization();
builder.Services
    .AddIdentityApiEndpoints<IdentityUser>(options =>
    {
        // Relaxed on purpose so the requested demo credentials (demo2026 / demo2026) are valid.
        // A real deployment would keep the defaults (upper case + symbol) or go further.
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequiredLength = 8;
    })
    .AddEntityFrameworkStores<AppDbContext>();

// The bearer tokens are encrypted with Data Protection keys. By default those keys live in the
// container's file system, so every restart/redeploy generated new keys and logged everybody out.
// Storing them in the database keeps sessions alive across restarts and lets several API
// instances read each other's tokens.
builder.Services.AddDataProtection()
    .SetApplicationName("Altairis.Backoffice")
    .PersistKeysToDbContext<AppDbContext>();

builder.Services.AddAuthRateLimiting();

// TimeProvider instead of DateTime.UtcNow inside services: tests can fake "today"
// (booking rules depend on the date). Scoped service: it uses the request's DbContext.
builder.Services.TryAddSingleton(TimeProvider.System);
builder.Services.AddScoped<ReservationService>();

// The API only receives traffic through nginx, so the TCP connection always comes from nginx.
// This reads the real client IP from X-Forwarded-For (needed for per-IP rate limiting).
// Cleared lists = trust any proxy: OK inside the private docker network; in production
// I'd list the proxy's address explicitly so clients can't spoof the header.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>();

var app = builder.Build();

// Apply migrations + seed on startup so "docker compose up" is the only step needed.
// Fine for a demo; in production migrations would run as a separate pipeline step
// (several API instances starting at once shouldn't all try to migrate).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DataSeeder.SeedAsync(db);
    await DataSeeder.SeedCataloguesAsync(db);
    await DataSeeder.SeedRoomsAsync(db);
    await InventorySeeder.SeedAsync(db);
    await ReservationSeeder.SeedAsync(db);
    await DataSeeder.SeedDemoUserAsync(scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>());
}

app.UseForwardedHeaders(); // first, so everything after sees the real client IP

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); // spec at /openapi/v1.json
}

// No HTTPS redirection and no CORS: the API sits behind the frontend's nginx (same origin),
// TLS would be terminated in front of everything in a real deployment.

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// RequireAuthorization here instead of [Authorize] on each controller: secure by default,
// a new controller can't be published by accident without auth. AuthController opts out
// explicitly with [AllowAnonymous].
app.MapControllers().RequireAuthorization();
app.MapHealthChecks("/health");

app.Run();
