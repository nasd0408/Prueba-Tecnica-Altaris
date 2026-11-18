using Altairis.Api.Data.Configurations;
using Altairis.Api.Entities;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Altairis.Api.Data;

// Identity tables (AspNetUsers, AspNetRoles...) live in the same database and context as the
// business data: one connection string, one migration history. Splitting them only makes sense
// if auth becomes a separate service (e.g. a central identity provider for several apps).
public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<IdentityUser>(options), IDataProtectionKeyContext
{
    public DbSet<Hotel> Hotels => Set<Hotel>();
    public DbSet<RoomType> RoomTypes => Set<RoomType>();
    public DbSet<Amenity> Amenities => Set<Amenity>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Availability> Availability => Set<Availability>();
    public DbSet<Reservation> Reservations => Set<Reservation>();

    // Keys used by ASP.NET Data Protection to encrypt the bearer tokens (see Program.cs).
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Must be called first: it maps all the Identity tables.
        base.OnModelCreating(modelBuilder);

        // Each entity has its own IEntityTypeConfiguration class instead of piling everything here.
        // With 4-5 entities it already pays off: the mapping of each table is easy to find and review.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Source of the reservation numbers (see ReservationConfiguration.Code).
        modelBuilder.HasSequence<int>(ReservationConfiguration.CodeSequence).StartsAt(1_000_001);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // SQL Server's datetime2 doesn't store the "kind", so EF reads dates back as Unspecified
        // and they're serialised without the trailing "Z". All dates are saved in UTC, so mark them
        // as UTC on the way out; the browser then converts them to the user's local time correctly.
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }
}

internal class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    v => v,
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
