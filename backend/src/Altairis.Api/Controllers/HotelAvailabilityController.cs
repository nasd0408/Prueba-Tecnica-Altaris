using Altairis.Api.Data;
using Altairis.Api.Dtos;
using Altairis.Api.Entities;
using Altairis.Api.Errors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Controllers;

[ApiController]
[Route("api/hotels/{hotelId:int}/availability")]
public class HotelAvailabilityController(AppDbContext db) : ControllerBase
{
    // The grid shows one column per day; beyond two months it stops being readable anyway.
    private const int MaxGridDays = 62;
    // Bulk loads are usually "the whole season"; one year is a safe upper bound.
    private const int MaxBulkDays = 366;

    [HttpGet]
    public async Task<ActionResult<AvailabilityGridDto>> GetGrid(
        int hotelId, [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        if (RangeError(from, to, MaxGridDays) is { } error)
            return error;

        if (!await db.Hotels.AnyAsync(h => h.Id == hotelId, ct))
            return NotFound();

        var rooms = await db.Rooms
            .AsNoTracking()
            .Where(r => r.HotelId == hotelId)
            .OrderBy(r => r.BasePrice)
            .Select(r => new { r.Id, TypeName = r.RoomType.Name, r.BasePrice })
            .ToListAsync(ct);

        // One query for all cells of the grid (a few hundred rows at most).
        var cells = await db.Availability
            .AsNoTracking()
            .Where(a => a.Room.HotelId == hotelId && a.Date >= from && a.Date <= to)
            .Select(a => new { a.RoomId, a.Date, a.TotalRooms, a.BookedRooms, a.Price })
            .ToDictionaryAsync(a => (a.RoomId, a.Date), ct);

        var dates = EachDay(from, to).ToList();

        var result = rooms.Select(room => new RoomAvailabilityDto(
            room.Id,
            room.TypeName,
            room.BasePrice,
            dates.Select(date => cells.TryGetValue((room.Id, date), out var c)
                ? new AvailabilityDayDto(date, c.TotalRooms, c.BookedRooms, c.TotalRooms - c.BookedRooms,
                    c.Price ?? room.BasePrice, c.Price is not null)
                : null).ToList()))
            .ToList();

        return new AvailabilityGridDto(from, to, result);
    }

    // Upsert: creates the nights that don't exist and updates the ones that do, for every
    // selected room. This is how hotels really load inventory ("30 doubles every day of July,
    // 120 EUR at weekends"), instead of night by night.
    [HttpPost]
    public async Task<ActionResult<BulkAvailabilityResult>> BulkLoad(
        int hotelId, BulkAvailabilityRequest request, CancellationToken ct)
    {
        if (RangeError(request.From, request.To, MaxBulkDays) is { } error)
            return error;

        // Past nights are history: changing them would only distort reports.
        if (request.From < Today())
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.AvailabilityPastDates());

        var roomIds = request.RoomIds.Distinct().ToList();
        var rooms = await db.Rooms
            .Where(r => r.HotelId == hotelId && roomIds.Contains(r.Id))
            .Select(r => new { r.Id, TypeName = r.RoomType.Name })
            .ToDictionaryAsync(r => r.Id, ct);

        // Every id must belong to this hotel; otherwise someone could write another hotel's inventory.
        if (rooms.Count != roomIds.Count)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.AvailabilityForeignRooms());

        var dates = EachDay(request.From, request.To)
            .Where(d => request.DaysOfWeek.Count == 0 || request.DaysOfWeek.Contains(d.DayOfWeek))
            .ToHashSet();

        if (dates.Count == 0)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.AvailabilityNoMatchingDays());

        // Load the existing nights of the range (tracked, they may be updated). Max ~366 x rooms.
        var existing = await db.Availability
            .Where(a => roomIds.Contains(a.RoomId) && a.Date >= request.From && a.Date <= request.To)
            .ToDictionaryAsync(a => (a.RoomId, a.Date), ct);

        // Can't put fewer rooms on sale than are already booked: those guests have a confirmed room.
        // Reject the whole request (not a partial save) and say exactly which nights collide.
        var conflicts = existing.Values
            .Where(a => dates.Contains(a.Date) && a.BookedRooms > request.TotalRooms)
            .OrderBy(a => a.Date)
            .ToList();
        if (conflicts.Count > 0)
        {
            return this.Error(StatusCodes.Status409Conflict, ApiErrors.AvailabilityBelowBooked(
                request.TotalRooms, conflicts.Count,
                conflicts.Take(5).Select(a => (rooms[a.RoomId].TypeName, a.Date, a.BookedRooms))));
        }

        int created = 0, updated = 0;
        foreach (var roomId in roomIds)
        {
            foreach (var date in dates)
            {
                if (existing.TryGetValue((roomId, date), out var row))
                {
                    row.TotalRooms = request.TotalRooms;
                    updated++;
                }
                else
                {
                    row = new Availability { RoomId = roomId, Date = date, TotalRooms = request.TotalRooms };
                    db.Availability.Add(row);
                    created++;
                }

                if (request.ResetPrice) row.Price = null;
                else if (request.Price is not null) row.Price = request.Price;
            }
        }

        // One SaveChanges = one transaction: either every night is saved or none.
        await db.SaveChangesAsync(ct);
        return new BulkAvailabilityResult(created, updated);
    }

    private ObjectResult? RangeError(DateOnly from, DateOnly to, int maxDays)
    {
        if (from == default || to == default)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.RangeRequired());
        if (to < from)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.RangeOrder());
        if (to.DayNumber - from.DayNumber + 1 > maxDays)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.RangeTooLong(maxDays));
        return null;
    }

    private static IEnumerable<DateOnly> EachDay(DateOnly from, DateOnly to)
    {
        for (var d = from; d <= to; d = d.AddDays(1))
            yield return d;
    }

    private static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow);
}
