using Altairis.Api.Data;
using Altairis.Api.Dtos;
using Altairis.Api.Entities;
using Altairis.Api.Errors;
using Altairis.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Controllers;

// Reads (list, detail, daily summary) query the DbContext directly, like the other controllers.
// Writes go through ReservationService, because they change the inventory and have rules.
[ApiController]
[Route("api/reservations")]
public class ReservationsController(AppDbContext db, ReservationService reservations, TimeProvider time) : ControllerBase
{
    private const int MaxPageSize = 100;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ReservationListItemDto>>> GetReservations(
        [FromQuery] ReservationQuery query, CancellationToken ct)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        var q = db.Reservations.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            // A reservation code is searched exactly (index seek). Anything else is a "contains"
            // over guest and hotel name, which scans: acceptable at this size, Full-Text Search later.
            q = term.StartsWith("ALT-", StringComparison.OrdinalIgnoreCase)
                ? q.Where(r => r.Code == term.ToUpper())
                : q.Where(r => r.GuestName.Contains(term) || r.Room.Hotel.Name.Contains(term));
        }

        if (query.Status is not null)
            q = q.Where(r => r.Status == query.Status);

        if (query.HotelId is not null)
            q = q.Where(r => r.Room.HotelId == query.HotelId);

        var dateType = query.DateType?.ToLowerInvariant();
        if (query.From is { } from)
        {
            q = dateType switch
            {
                "checkout" => q.Where(r => r.CheckOut >= from),
                "created" => q.Where(r => r.CreatedAt >= from.ToDateTime(TimeOnly.MinValue)),
                "stay" => q.Where(r => r.CheckOut > from), // the stay still has a night on/after From
                _ => q.Where(r => r.CheckIn >= from),
            };
        }
        if (query.To is { } to)
        {
            q = dateType switch
            {
                "checkout" => q.Where(r => r.CheckOut <= to),
                "created" => q.Where(r => r.CreatedAt < to.AddDays(1).ToDateTime(TimeOnly.MinValue)),
                "stay" => q.Where(r => r.CheckIn <= to), // and it starts on/before To
                _ => q.Where(r => r.CheckIn <= to),
            };
        }

        var total = await q.CountAsync(ct);

        // Default order = newest bookings first. When filtering by arrival/departure, order by that
        // date instead: it's the order a front desk works through the list.
        q = dateType switch
        {
            "checkin" or "stay" => q.OrderBy(r => r.CheckIn).ThenBy(r => r.Id),
            "checkout" => q.OrderBy(r => r.CheckOut).ThenBy(r => r.Id),
            _ => q.OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id),
        };

        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ReservationListItemDto(
                r.Id, r.Code, r.Room.HotelId, r.Room.Hotel.Name, r.Room.Hotel.City, r.Room.RoomType.Name,
                r.GuestName, r.CheckIn, r.CheckOut, r.CheckOut.DayNumber - r.CheckIn.DayNumber,
                r.Rooms, r.Guests, r.TotalPrice, r.Status, r.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<ReservationListItemDto>(items, page, pageSize, total);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ReservationDto>> GetReservation(int id, CancellationToken ct)
    {
        var reservation = await GetDtoAsync(id, ct);
        return reservation is null ? NotFound() : reservation;
    }

    [HttpGet("quote")]
    public async Task<ActionResult<QuoteDto>> Quote(
        [FromQuery] int roomId, [FromQuery] DateOnly checkIn, [FromQuery] DateOnly checkOut,
        [FromQuery] int rooms = 1, CancellationToken ct = default) =>
        this.ToActionResult(await reservations.QuoteAsync(roomId, checkIn, checkOut, rooms, ct));

    [HttpPost]
    public async Task<ActionResult<ReservationDto>> Create(CreateReservationRequest request, CancellationToken ct)
    {
        // User.Identity.Name = the signed-in user (from the bearer token): who made the booking.
        var result = await reservations.CreateAsync(request, User.Identity?.Name, ct);
        if (!result.Succeeded)
            return this.Error(result.Status, result.Error!);

        return CreatedAtAction(nameof(GetReservation), new { id = result.Value }, await GetDtoAsync(result.Value, ct));
    }

    // Actions as sub-resources (POST .../cancel) instead of PATCH { status: "Cancelled" }:
    // each transition has its own rules and side effects, and the URL names the intent.
    [HttpPost("{id:int}/cancel")]
    public Task<ActionResult<ReservationDto>> Cancel(int id, CancellationToken ct) =>
        RunAction(reservations.CancelAsync(id, ct), ct);

    [HttpPost("{id:int}/check-in")]
    public Task<ActionResult<ReservationDto>> CheckIn(int id, CancellationToken ct) =>
        RunAction(reservations.CheckInAsync(id, ct), ct);

    [HttpPost("{id:int}/check-out")]
    public Task<ActionResult<ReservationDto>> CheckOut(int id, CancellationToken ct) =>
        RunAction(reservations.CheckOutAsync(id, ct), ct);

    [HttpPost("{id:int}/no-show")]
    public Task<ActionResult<ReservationDto>> NoShow(int id, CancellationToken ct) =>
        RunAction(reservations.NoShowAsync(id, ct), ct);

    // "What's happening today": arrivals, departures, guests in house, and today's sales.
    [HttpGet("daily")]
    public async Task<ActionResult<DailySummaryDto>> Daily([FromQuery] DateOnly? date, CancellationToken ct)
    {
        var day = date ?? DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime);
        var dayStart = day.ToDateTime(TimeOnly.MinValue);
        var dayEnd = day.AddDays(1).ToDateTime(TimeOnly.MinValue);

        var r = db.Reservations.AsNoTracking();
        // Cancelled and no-shows don't arrive, leave or sleep: they're excluded from operations.
        var active = r.Where(x => x.Status != ReservationStatus.Cancelled && x.Status != ReservationStatus.NoShow);

        // Several small COUNT queries: each one uses its own index (CheckIn, CheckOut, CreatedAt).
        var arrivals = await active.CountAsync(x => x.CheckIn == day, ct);
        var arrivalsPending = await r.CountAsync(x => x.CheckIn == day && x.Status == ReservationStatus.Confirmed, ct);
        var departures = await active.CountAsync(x => x.CheckOut == day, ct);
        var departuresPending = await r.CountAsync(x => x.CheckOut == day && x.Status == ReservationStatus.CheckedIn, ct);
        var inHouse = await active.CountAsync(x => x.CheckIn <= day && x.CheckOut > day, ct);

        var created = r.Where(x => x.CreatedAt >= dayStart && x.CreatedAt < dayEnd);
        var newBookings = await created.CountAsync(ct);
        var newRevenue = await created.SumAsync(x => (decimal?)x.TotalPrice, ct) ?? 0;
        var cancellations = await r.CountAsync(x => x.CancelledAt >= dayStart && x.CancelledAt < dayEnd, ct);

        // Breakdown by country in one grouped query: each reservation counts as arrival,
        // departure and/or in-house through conditional sums.
        var byCountry = await active
            .Where(x => x.CheckIn <= day && x.CheckOut >= day)
            .GroupBy(x => x.Room.Hotel.Country)
            .Select(g => new
            {
                Country = g.Key,
                Arrivals = g.Sum(x => x.CheckIn == day ? 1 : 0),
                Departures = g.Sum(x => x.CheckOut == day ? 1 : 0),
                InHouse = g.Sum(x => x.CheckIn <= day && x.CheckOut > day ? 1 : 0),
            })
            .OrderByDescending(x => x.InHouse)
            .ToListAsync(ct);

        return new DailySummaryDto(day, arrivals, arrivalsPending, departures, departuresPending, inHouse,
            newBookings, newRevenue, cancellations,
            byCountry.Select(c => new CountryActivityDto(c.Country, c.Arrivals, c.Departures, c.InHouse)).ToList());
    }

    private async Task<ActionResult<ReservationDto>> RunAction(Task<ServiceResult<int>> action, CancellationToken ct)
    {
        var result = await action;
        return result.Succeeded ? (await GetDtoAsync(result.Value, ct))! : this.Error(result.Status, result.Error!);
    }

    private Task<ReservationDto?> GetDtoAsync(int id, CancellationToken ct) =>
        db.Reservations
            .AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new ReservationDto(
                r.Id, r.Code, r.Room.HotelId, r.Room.Hotel.Name, r.Room.Hotel.City, r.Room.Hotel.Country,
                r.RoomId, r.Room.RoomType.Name, r.Room.RoomType.Capacity,
                r.CheckIn, r.CheckOut, r.CheckOut.DayNumber - r.CheckIn.DayNumber, r.Rooms, r.Guests,
                r.GuestName, r.GuestEmail, r.GuestPhone, r.Notes, r.TotalPrice, r.Status,
                r.CreatedAt, r.CreatedBy, r.CancelledAt))
            .FirstOrDefaultAsync(ct);
}
