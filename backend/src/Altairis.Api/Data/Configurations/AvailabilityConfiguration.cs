using Altairis.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Altairis.Api.Data.Configurations;

public class AvailabilityConfiguration : IEntityTypeConfiguration<Availability>
{
    public void Configure(EntityTypeBuilder<Availability> builder)
    {
        builder.ToTable("Availability", t =>
        {
            // The invariant that matters most: never more booked than on sale.
            // Enforced by the DB too, so a bug in the booking code can't silently overbook.
            t.HasCheckConstraint("CK_Availability_TotalRooms", "[TotalRooms] >= 0");
            t.HasCheckConstraint("CK_Availability_BookedRooms", "[BookedRooms] >= 0 AND [BookedRooms] <= [TotalRooms]");
            t.HasCheckConstraint("CK_Availability_Price", "[Price] IS NULL OR [Price] >= 0");
        });

        builder.Property(a => a.Price).HasPrecision(10, 2);
        builder.Property(a => a.RowVersion).IsRowVersion();

        // One row per room and night. Also the index for the hotel grid
        // ("rooms of hotel X between two dates" seeks by RoomId, then a Date range).
        builder.HasIndex(a => new { a.RoomId, a.Date }).IsUnique();

        // For the global views (all hotels, one date range): seek by Date and read the counters
        // straight from the index (covering index), without touching the table rows.
        builder.HasIndex(a => a.Date)
            .IncludeProperties(a => new { a.RoomId, a.TotalRooms, a.BookedRooms });

        builder.HasOne(a => a.Room)
            .WithMany(r => r.Availability)
            .HasForeignKey(a => a.RoomId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
