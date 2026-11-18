using Altairis.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Data;

// Identity tables (AspNetUsers, AspNetRoles...) live in the same database and context as the
// business data: one connection string, one migration history. Splitting them only makes sense
// if auth becomes a separate service (e.g. a central identity provider for several apps).
public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<IdentityUser>(options)
{
    public DbSet<Hotel> Hotels => Set<Hotel>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Must be called first: it maps all the Identity tables.
        base.OnModelCreating(modelBuilder);

        // Each entity has its own IEntityTypeConfiguration class instead of piling everything here.
        // With 4-5 entities it already pays off: the mapping of each table is easy to find and review.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
