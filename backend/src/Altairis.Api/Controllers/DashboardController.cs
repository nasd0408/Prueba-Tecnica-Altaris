using Altairis.Api.Data;
using Altairis.Api.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController(AppDbContext db) : ControllerBase
{
    private const int TopCountries = 8;

    [HttpGet]
    public async Task<ActionResult<DashboardSummary>> GetSummary(CancellationToken ct)
    {
        // All aggregations run in SQL (GROUP BY / COUNT); only the small result sets travel.
        // Queries run one after another on purpose: a DbContext can't run queries in parallel.
        var hotels = db.Hotels.AsNoTracking();

        var total = await hotels.CountAsync(ct);
        var active = await hotels.CountAsync(h => h.IsActive, ct);
        var countries = await hotels.Select(h => h.Country).Distinct().CountAsync(ct);
        var cities = await hotels.Select(h => new { h.Country, h.City }).Distinct().CountAsync(ct);
        var rooms = await db.Rooms.CountAsync(ct);

        // Sort/filter on an anonymous type and build the DTO at the end: EF can translate
        // OrderBy over anonymous members, but not over properties of a record created in Select.
        var byCountry = await hotels
            .GroupBy(h => h.Country)
            .Select(g => new { Country = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(TopCountries)
            .Select(x => new CountItem(x.Country, x.Count))
            .ToListAsync(ct);

        // Same idea; the label is formatted in memory because EF can't translate ToString()
        // on a group key (only 5 rows).
        var byStars = (await hotels
                .GroupBy(h => h.Stars)
                .Select(g => new { Stars = g.Key, Count = g.Count() })
                .OrderBy(x => x.Stars)
                .ToListAsync(ct))
            .Select(x => new CountItem(x.Stars.ToString(), x.Count))
            .ToList();

        var latest = await hotels
            .OrderByDescending(h => h.CreatedAt)
            .Take(5)
            .Select(h => new HotelDto(h.Id, h.Name, h.City, h.Country, h.Address, h.Stars,
                h.Email, h.Phone, h.IsActive, h.CreatedAt, h.Rooms.Count))
            .ToListAsync(ct);

        return new DashboardSummary(total, active, countries, cities, rooms, byCountry, byStars, latest);
    }
}
