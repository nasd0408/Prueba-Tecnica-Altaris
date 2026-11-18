using Altairis.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Altairis.Api.Data.Configurations;

public class RoomTypeConfiguration : IEntityTypeConfiguration<RoomType>
{
    public void Configure(EntityTypeBuilder<RoomType> builder)
    {
        // Rule repeated in the DB on purpose: the API validates it, but the database is the
        // last line of defence against scripts, imports or a future bug.
        builder.ToTable("RoomTypes", t => t.HasCheckConstraint("CK_RoomTypes_Capacity", "[Capacity] BETWEEN 1 AND 20"));

        builder.Property(r => r.Name).HasMaxLength(100).IsRequired();
        builder.Property(r => r.Description).HasMaxLength(500);

        // The whole point of a catalogue: each name exists once.
        builder.HasIndex(r => r.Name).IsUnique();
    }
}
