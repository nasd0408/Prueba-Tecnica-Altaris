using Altairis.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Altairis.Api.Data.Configurations;

public class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.ToTable("Rooms", t => t.HasCheckConstraint("CK_Rooms_BasePrice", "[BasePrice] >= 0"));

        builder.Property(r => r.BasePrice).HasPrecision(10, 2); // up to 99,999,999.99
        builder.Property(r => r.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

        // A hotel offers each room type once. Keeps availability unambiguous ("Doubles of hotel X"
        // is one row). If a hotel needed two Double variants (sea view / city view) the catalogue
        // would get a new type, or this index would include a variant name.
        // HotelId is the first column, so the index also serves "rooms of hotel X" queries.
        builder.HasIndex(r => new { r.HotelId, r.RoomTypeId }).IsUnique();

        // Restrict, not cascade, on both sides: hotels and catalogue entries are deactivated or
        // edited, not deleted. If someone tries, the DB refuses instead of wiping rooms (and later
        // reservations) with them.
        builder.HasOne(r => r.Hotel)
            .WithMany(h => h.Rooms)
            .HasForeignKey(r => r.HotelId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.RoomType)
            .WithMany(t => t.Rooms)
            .HasForeignKey(r => r.RoomTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Join table with only the two keys (composite PK). Cascade here is fine: removing a room
        // or an amenity should just remove the link rows, there's no history in them.
        builder.HasMany(r => r.Amenities)
            .WithMany(a => a.Rooms)
            .UsingEntity(j => j.ToTable("RoomAmenities"));
    }
}
