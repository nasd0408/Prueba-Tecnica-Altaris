using Altairis.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Altairis.Api.Data.Configurations;

public class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public const string CodeSequence = "ReservationNumbers";

    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.ToTable("Reservations", t =>
        {
            t.HasCheckConstraint("CK_Reservations_Dates", "[CheckOut] > [CheckIn]");
            t.HasCheckConstraint("CK_Reservations_Rooms", "[Rooms] >= 1");
            t.HasCheckConstraint("CK_Reservations_Guests", "[Guests] >= 1");
        });

        // Code comes from the DB: 'ALT-' + next number of the sequence (declared in AppDbContext).
        // EF reads the generated value back after the INSERT, so the API can return it straight away.
        builder.Property(r => r.Code)
            .HasMaxLength(20)
            .HasDefaultValueSql($"CONCAT('ALT-', NEXT VALUE FOR {CodeSequence})")
            .ValueGeneratedOnAdd();
        builder.HasIndex(r => r.Code).IsUnique();

        // Stored as text ("Confirmed"), not 0/1/2: readable in SQL and in reports, and adding
        // a new status in the middle of the enum can't silently change the meaning of old rows.
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);

        builder.Property(r => r.GuestName).HasMaxLength(150).IsRequired();
        builder.Property(r => r.GuestEmail).HasMaxLength(150).IsRequired();
        builder.Property(r => r.GuestPhone).HasMaxLength(30);
        builder.Property(r => r.Notes).HasMaxLength(500);
        builder.Property(r => r.CreatedBy).HasMaxLength(64);
        builder.Property(r => r.TotalPrice).HasPrecision(12, 2);

        // Computed in C#, not a column.
        builder.Ignore(r => r.Nights);

        // Indexes for how reservations are looked up: by arrival / departure date (daily
        // operations), by creation date (latest bookings), and by room + dates (inventory checks).
        builder.HasIndex(r => r.CheckIn);
        builder.HasIndex(r => r.CheckOut);
        builder.HasIndex(r => r.CreatedAt);
        builder.HasIndex(r => new { r.RoomId, r.CheckIn });

        builder.HasOne(r => r.Room)
            .WithMany(room => room.Reservations)
            .HasForeignKey(r => r.RoomId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
