using Microsoft.AspNetCore.Identity;
using Altairis.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Data;

/// <summary>
/// Fills an empty database with demo data so the app is usable right after "docker compose up".
/// </summary>
public static class DataSeeder
{
    // Big enough to prove that listing/search are done server side (the UI would choke
    // loading 10k rows at once), small enough to seed in a couple of seconds.
    private const int HotelCount = 10_000;

    private static readonly (string City, string Country)[] Cities =
    [
        ("Madrid", "Spain"), ("Barcelona", "Spain"), ("Sevilla", "Spain"), ("Valencia", "Spain"),
        ("Malaga", "Spain"), ("Palma", "Spain"), ("Bilbao", "Spain"), ("Granada", "Spain"),
        ("Lisboa", "Portugal"), ("Porto", "Portugal"), ("Faro", "Portugal"),
        ("Paris", "France"), ("Nice", "France"), ("Lyon", "France"),
        ("Roma", "Italy"), ("Milano", "Italy"), ("Firenze", "Italy"), ("Venezia", "Italy"),
        ("London", "United Kingdom"), ("Edinburgh", "United Kingdom"),
        ("Berlin", "Germany"), ("Munich", "Germany"),
        ("Amsterdam", "Netherlands"), ("Brussels", "Belgium"), ("Vienna", "Austria"),
        ("Cancun", "Mexico"), ("Ciudad de Mexico", "Mexico"),
        ("Buenos Aires", "Argentina"), ("Bogota", "Colombia"), ("Cartagena", "Colombia"),
        ("Lima", "Peru"), ("Santiago", "Chile"), ("Punta Cana", "Dominican Republic"),
        ("New York", "United States"), ("Miami", "United States"),
    ];

    private static readonly string[] Prefixes =
        ["Hotel", "Gran Hotel", "Hostal", "Resort", "Suites", "Apartamentos", "Boutique Hotel", "Palacio"];

    private static readonly string[] Names =
    [
        "Mirador", "Atlantico", "Las Palmeras", "Sol y Mar", "Plaza Mayor", "Real", "Alameda", "Colonial",
        "Puerta del Sol", "Bahia", "Costa Azul", "Los Olivos", "Central", "Del Parque", "San Marcos",
        "Imperial", "Riviera", "La Muralla", "El Faro", "Mediterraneo", "Montecarlo", "Victoria",
        "Las Dunas", "Bellavista", "Aurora", "Catedral", "Del Rio", "La Estacion", "Miramar", "Oasis",
    ];

    private static readonly string[] Streets =
        ["Calle Mayor", "Avenida del Mar", "Paseo Maritimo", "Calle Real", "Plaza Central", "Avenida Libertad", "Calle del Sol"];

    // Demo account for the client presentation. Created through UserManager (not a raw insert)
    // so the password gets hashed and validated exactly like a normal registration.
    public const string DemoUserName = "demo2026";
    private const string DemoPassword = "demo2026";

    public static async Task SeedDemoUserAsync(UserManager<IdentityUser> users)
    {
        if (await users.FindByNameAsync(DemoUserName) is not null)
            return;

        var user = new IdentityUser
        {
            UserName = DemoUserName,
            Email = "demo2026@altairis.test",
            EmailConfirmed = true,
        };

        var result = await users.CreateAsync(user, DemoPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException(
                "Could not create demo user: " + string.Join(", ", result.Errors.Select(e => e.Description)));
    }

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (await db.Hotels.AnyAsync(ct))
            return; // never touch a database that already has data

        // Fixed seed => same data on every machine. Useful for a demo: "search Bahia in Lisboa"
        // gives the same result for me and for whoever reviews it.
        var random = new Random(2024);
        var hotels = new List<Hotel>(HotelCount);

        for (var i = 1; i <= HotelCount; i++)
        {
            var (city, country) = Cities[random.Next(Cities.Length)];
            var name = $"{Prefixes[random.Next(Prefixes.Length)]} {Names[random.Next(Names.Length)]} {city}";
            var slug = name.ToLowerInvariant().Replace(' ', '-');

            hotels.Add(new Hotel
            {
                // The counter avoids duplicated names, which would look odd in the demo.
                Name = $"{name} {i}",
                City = city,
                Country = country,
                Address = $"{Streets[random.Next(Streets.Length)]} {random.Next(1, 300)}",
                // Weighted towards 3-4 stars, like a real catalogue.
                Stars = random.Next(100) switch { < 5 => 1, < 20 => 2, < 55 => 3, < 85 => 4, _ => 5 },
                Email = $"reservas@{slug}.com",
                Phone = $"+34 9{random.Next(10_000_000, 99_999_999)}",
                IsActive = random.Next(100) >= 7,
                CreatedAt = DateTime.UtcNow.AddDays(-random.Next(0, 730)),
            });
        }

        // A single SaveChanges: EF Core batches the inserts (many rows per round trip).
        // Turning off change detection avoids scanning the whole tracked list on every Add.
        db.ChangeTracker.AutoDetectChangesEnabled = false;
        db.Hotels.AddRange(hotels);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.AutoDetectChangesEnabled = true;
    }
}
