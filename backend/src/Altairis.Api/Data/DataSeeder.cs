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

    // Catalogue: (name, capacity, description, reference price for a 1-star hotel).
    // The price isn't stored in the catalogue (each hotel sets its own); it's only used to seed rooms.
    private static readonly (string Name, int Capacity, string Description, decimal Price)[] RoomTypeCatalogue =
    [
        ("Single", 1, "One single bed.", 35m),
        ("Double", 2, "One double bed.", 50m),
        ("Twin", 2, "Two single beds.", 50m),
        ("Triple", 3, "Three single beds or one double plus one single.", 65m),
        ("Family", 4, "Two double beds or a double plus bunk beds.", 80m),
        ("Junior Suite", 2, "Double bed and separate sitting area.", 95m),
        ("Suite", 3, "Bedroom plus separate living room.", 140m),
        ("Luxury Suite", 4, "Large suite with premium finishes and services.", 220m),
    ];

    private static readonly string[] AmenityCatalogue =
    [
        "Wi-Fi", "TV", "Air conditioning", "Minibar", "Safe", "Balcony", "Sea view", "Pool access",
        "Pet friendly", "Bunk beds", "Bathtub", "Kitchenette", "Accessible", "Coffee machine",
    ];

    // Catalogues get their own "is it empty?" check: they're reference data the app needs
    // even in an otherwise empty database.
    public static async Task SeedCataloguesAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (!await db.RoomTypes.AnyAsync(ct))
        {
            db.RoomTypes.AddRange(RoomTypeCatalogue.Select(t =>
                new RoomType { Name = t.Name, Capacity = t.Capacity, Description = t.Description }));
        }

        if (!await db.Amenities.AnyAsync(ct))
        {
            db.Amenities.AddRange(AmenityCatalogue.Select(name => new Amenity { Name = name }));
        }

        await db.SaveChangesAsync(ct);
    }

    // Rooms for the demo hotels: 2-5 room types each, priced by hotel category,
    // with amenities that make sense for the type and category.
    public static async Task SeedRoomsAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (await db.Rooms.AnyAsync(ct))
            return;

        // Only the two columns needed, not full entities: 10k small rows.
        var hotels = await db.Hotels.AsNoTracking().Select(h => new { h.Id, h.Stars }).ToListAsync(ct);
        var roomTypes = await db.RoomTypes.AsNoTracking().ToDictionaryAsync(t => t.Name, ct);
        // Tracked on purpose: assigning these instances to Room.Amenities makes EF insert
        // only the link rows (RoomAmenities), not new amenities.
        var amenities = await db.Amenities.ToDictionaryAsync(a => a.Name, ct);

        var random = new Random(2025);
        var rooms = new List<Room>(hotels.Count * 4);

        foreach (var hotel in hotels)
        {
            // Suites from 4 stars, Luxury Suite only in 5-star hotels. Every hotel sells a Double.
            var offered = RoomTypeCatalogue
                .Where(t => t.Name != "Double")
                .Where(t => t.Name switch
                {
                    "Junior Suite" or "Suite" => hotel.Stars >= 4,
                    "Luxury Suite" => hotel.Stars == 5,
                    _ => true,
                })
                .OrderBy(_ => random.Next())
                .Take(random.Next(1, 5))
                .Prepend(RoomTypeCatalogue[1]);

            // More stars, higher price: +35% per star over the 1-star reference, whole euros.
            var priceFactor = 1 + (hotel.Stars - 1) * 0.35m;

            foreach (var type in offered)
            {
                rooms.Add(new Room
                {
                    HotelId = hotel.Id,
                    RoomTypeId = roomTypes[type.Name].Id,
                    BasePrice = Math.Round(type.Price * priceFactor),
                    Amenities = PickAmenities(type.Name, hotel.Stars, random).Select(n => amenities[n]).ToList(),
                    CreatedAt = DateTime.UtcNow,
                });
            }
        }

        db.ChangeTracker.AutoDetectChangesEnabled = false;
        db.Rooms.AddRange(rooms);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.AutoDetectChangesEnabled = true;
    }

    private static IEnumerable<string> PickAmenities(string roomType, int stars, Random random)
    {
        bool Chance(int percent) => random.Next(100) < percent;
        var isSuite = roomType.Contains("Suite");

        if (Chance(95)) yield return "Wi-Fi";
        if (Chance(90)) yield return "TV";
        if (stars >= 3 || Chance(40)) yield return "Air conditioning";
        if (stars >= 4 || isSuite) yield return "Minibar";
        if (stars >= 3 && Chance(70)) yield return "Safe";
        if (isSuite || Chance(25)) yield return "Balcony";
        if (Chance(15)) yield return "Sea view";
        if (stars >= 3 && Chance(30)) yield return "Pool access";
        if (Chance(15)) yield return "Pet friendly";
        if (roomType is "Family" or "Triple" && Chance(50)) yield return "Bunk beds";
        if (isSuite) yield return "Bathtub";
        if (roomType == "Family" && Chance(30)) yield return "Kitchenette";
        if (Chance(10)) yield return "Accessible";
        if (stars >= 4 && Chance(50)) yield return "Coffee machine";
    }
}
