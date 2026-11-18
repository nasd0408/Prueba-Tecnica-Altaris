using Altairis.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Altairis.Api.Data.Configurations;

public class HotelConfiguration : IEntityTypeConfiguration<Hotel>
{
    public void Configure(EntityTypeBuilder<Hotel> builder)
    {
        builder.ToTable("Hotels", t => t.HasCheckConstraint("CK_Hotels_Stars", "[Stars] BETWEEN 1 AND 5"));

        // Explicit lengths: without them EF maps strings to nvarchar(max), which can't be indexed.
        builder.Property(h => h.Name).HasMaxLength(150).IsRequired();
        builder.Property(h => h.City).HasMaxLength(100).IsRequired();
        builder.Property(h => h.Country).HasMaxLength(100).IsRequired();
        builder.Property(h => h.Address).HasMaxLength(250);
        builder.Property(h => h.Email).HasMaxLength(150);
        builder.Property(h => h.Phone).HasMaxLength(30);

        // Default set by the DB so rows inserted outside the API (scripts, imports) also get a date.
        builder.Property(h => h.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

        // Indexes follow the list screen: default sort is by name, filters are by country/stars.
        // Note: the free-text search uses LIKE '%term%', which can't seek on an index anyway.
        // For 10k rows that's a few ms; with millions I'd move to Full-Text Search or a search engine.
        builder.HasIndex(h => h.Name);
        builder.HasIndex(h => new { h.Country, h.City });
        builder.HasIndex(h => h.Stars);
    }
}
