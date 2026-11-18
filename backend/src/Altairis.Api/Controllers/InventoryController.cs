using Altairis.Api.Data;
using Altairis.Api.Dtos;
using Altairis.Api.Errors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Controllers;

// Cross-hotel view of the inventory: "how full are we over the next days, and where are we
// about to run out?". The questions operations asks every morning.
[ApiController]
[Route("api/inventory")]
public class InventoryController(AppDbContext db) : ControllerBase
{
    private const int MaxDays = 62;
    private const int TightHotelsCount = 15;

    [HttpGet("overview")]
    public async Task<ActionResult<InventoryOverviewDto>> GetOverview(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] string? country, CancellationToken ct)
    {
        if (from == default || to == default)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.RangeRequired());
        if (to < from)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.RangeOrder());
        if (to.DayNumber - from.DayNumber + 1 > MaxDays)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.RangeTooLong(MaxDays));

        // Inactive hotels don't sell, so their inventory would only dilute the occupancy figures.
        var nights = db.Availability
            .AsNoTracking()
            .Where(a => a.Date >= from && a.Date <= to && a.Room.Hotel.IsActive);

        if (!string.IsNullOrWhiteSpace(country))
            nights = nights.Where(a => a.Room.Hotel.Country == country);

        // Per-day totals: GROUP BY Date in SQL over a few hundred thousand rows; ~30 rows come back.
        var days = await nights
            .GroupBy(a => a.Date)
            .Select(g => new InventoryDayDto(
                g.Key,
                g.Sum(a => a.TotalRooms),
                g.Sum(a => a.BookedRooms),
                // Sold out = rooms of a type with nothing left that night (stop-sell rows with 0 excluded).
                g.Count(a => a.TotalRooms > 0 && a.BookedRooms >= a.TotalRooms)))
            .ToListAsync(ct);
        days = days.OrderBy(d => d.Date).ToList();

        // Hotels closest to full over the range: where sales should stop pushing and
        // revenue could raise prices. Ordered by occupancy in SQL, only the top N travel.
        var tight = await nights
            .GroupBy(a => a.Room.HotelId)
            .Select(g => new { HotelId = g.Key, Total = g.Sum(a => a.TotalRooms), Booked = g.Sum(a => a.BookedRooms) })
            .Where(x => x.Total > 0)
            .OrderByDescending(x => (double)x.Booked / x.Total)
            .ThenByDescending(x => x.Booked)
            .Take(TightHotelsCount)
            .ToListAsync(ct);

        var tightIds = tight.Select(t => t.HotelId).ToList();
        var hotelInfo = await db.Hotels
            .AsNoTracking()
            .Where(h => tightIds.Contains(h.Id))
            .Select(h => new { h.Id, h.Name, h.City, h.Country })
            .ToDictionaryAsync(h => h.Id, ct);

        var tightestHotels = tight
            .Select(t => new TightHotelDto(t.HotelId, hotelInfo[t.HotelId].Name, hotelInfo[t.HotelId].City,
                hotelInfo[t.HotelId].Country, t.Total, t.Booked, Math.Round((double)t.Booked / t.Total, 4)))
            .ToList();

        return new InventoryOverviewDto(
            from, to,
            days.Sum(d => d.TotalRooms),
            days.Sum(d => d.BookedRooms),
            days.Sum(d => d.SoldOutRooms),
            days,
            tightestHotels);
    }
}
