using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Altairis.Api.Auth;

public static class RateLimitPolicies
{
    public const string Auth = "auth";

    // Built-in ASP.NET Core rate limiter (no extra package).
    // Fixed window per client IP: 10 requests per minute on the anonymous auth endpoints.
    // Enough for a person who mistypes a password, too little for a script trying passwords
    // or creating users in bulk. Over the limit -> 429 Too Many Requests.
    public static IServiceCollection AddAuthRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.AddPolicy(Auth, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    // Real client IP thanks to UseForwardedHeaders (otherwise it'd be nginx's IP
                    // and every user would share the same bucket).
                    partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0, // reject straight away, don't hold requests in memory
                    }));
        });
}
