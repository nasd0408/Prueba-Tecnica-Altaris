using Altairis.Api.Data;
using Altairis.Api.Dtos;
using Altairis.Api.Entities;
using Altairis.Api.Errors;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Services;

/// <summary>
/// Booking rules. This is the first piece of real business logic in the API, so it lives in a
/// service instead of the controller: it's the only place that changes Availability.BookedRooms,
/// and it can be unit-tested without HTTP.
/// </summary>
public class ReservationService(AppDbContext db, TimeProvider time)
{
    public const int MaxNights = 30;
    private const int MaxConcurrencyRetries = 3;

    private DateOnly Today => DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime);

    // ---------- Quote ----------

    // Same checks as a booking, without writing anything. The form calls it while the user
    // types, so problems ("only 2 left on the 21st") show before pressing "Book".
    public async Task<ServiceResult<QuoteDto>> QuoteAsync(
        int roomId, DateOnly checkIn, DateOnly checkOut, int rooms, CancellationToken ct)
    {
        if (ValidateStay(checkIn, checkOut, rooms) is { } invalid)
            return ServiceResult<QuoteDto>.Invalid(invalid);

        var room = await LoadRoomAsync(roomId, ct);
        if (room is null)
            return ServiceResult<QuoteDto>.NotFound(ApiErrors.RoomNotFound());

        var nights = await db.Availability
            .AsNoTracking()
            .Where(a => a.RoomId == roomId && a.Date >= checkIn && a.Date < checkOut)
            .ToDictionaryAsync(a => a.Date, ct);

        var detail = EachNight(checkIn, checkOut)
            .Select(d => nights.TryGetValue(d, out var n)
                ? new QuoteNightDto(d, n.TotalRooms - n.BookedRooms, n.Price ?? room.BasePrice)
                : new QuoteNightDto(d, null, room.BasePrice))
            .ToList();

        var problem = !room.HotelIsActive
            ? ApiErrors.HotelInactive()
            : AvailabilityProblem(room.TypeName, detail.Select(d => (d.Date, d.Available)), rooms);

        return ServiceResult<QuoteDto>.Ok(new QuoteDto(
            roomId, room.HotelName, room.TypeName, room.Capacity, checkIn, checkOut,
            detail.Count, rooms, room.Capacity * rooms,
            detail.Sum(d => d.Price) * rooms,
            problem is null, problem, detail));
    }

    // ---------- Create ----------

    public async Task<ServiceResult<int>> CreateAsync(CreateReservationRequest request, string? userName, CancellationToken ct)
    {
        if (ValidateStay(request.CheckIn, request.CheckOut, request.Rooms) is { } invalid)
            return ServiceResult<int>.Invalid(invalid);

        // Retry loop for optimistic concurrency: if someone else booked the same nights between
        // our read and our save, the rowversion check makes SaveChanges fail. We then start over
        // with fresh data; on the next pass the availability check sees their booking and either
        // still fits or returns "sold out". Nobody overbooks and nobody waits on a lock.
        for (var attempt = 1; ; attempt++)
        {
            db.ChangeTracker.Clear();
            try
            {
                return await TryCreateAsync(request, userName, ct);
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxConcurrencyRetries)
            {
                // someone changed the same nights: try again with fresh data
            }
            catch (DbUpdateConcurrencyException)
            {
                return ServiceResult<int>.Conflict(ApiErrors.ConcurrentChange());
            }
        }
    }

    private async Task<ServiceResult<int>> TryCreateAsync(CreateReservationRequest request, string? userName, CancellationToken ct)
    {
        var room = await LoadRoomAsync(request.RoomId, ct);
        if (room is null)
            return ServiceResult<int>.NotFound(ApiErrors.RoomNotFound());
        if (!room.HotelIsActive)
            return ServiceResult<int>.Conflict(ApiErrors.HotelInactive());

        if (request.Guests > room.Capacity * request.Rooms)
        {
            return ServiceResult<int>.Invalid(
                ApiErrors.TooManyGuests(request.Guests, request.Rooms, room.TypeName, room.Capacity * request.Rooms));
        }

        // Tracked on purpose: these are the rows we're going to update.
        var nights = await db.Availability
            .Where(a => a.RoomId == request.RoomId && a.Date >= request.CheckIn && a.Date < request.CheckOut)
            .ToListAsync(ct);

        var byDate = nights.ToDictionary(n => n.Date);
        var problem = AvailabilityProblem(room.TypeName,
            EachNight(request.CheckIn, request.CheckOut)
                .Select(d => (d, byDate.TryGetValue(d, out var n) ? n.TotalRooms - n.BookedRooms : (int?)null)),
            request.Rooms);
        if (problem is not null)
            return ServiceResult<int>.Conflict(problem);

        foreach (var night in nights)
            night.BookedRooms += request.Rooms;

        var reservation = new Reservation
        {
            RoomId = request.RoomId,
            CheckIn = request.CheckIn,
            CheckOut = request.CheckOut,
            Rooms = request.Rooms,
            Guests = request.Guests,
            GuestName = request.GuestName.Trim(),
            GuestEmail = request.GuestEmail.Trim(),
            GuestPhone = string.IsNullOrWhiteSpace(request.GuestPhone) ? null : request.GuestPhone.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            // Price frozen now, from the same rows we just checked.
            TotalPrice = nights.Sum(n => n.Price ?? room.BasePrice) * request.Rooms,
            Status = ReservationStatus.Confirmed,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            CreatedBy = userName,
        };
        db.Reservations.Add(reservation);

        // One SaveChanges = one transaction: the reservation and all its nights are saved
        // together, or nothing is (no half-booked stays).
        await db.SaveChangesAsync(ct);
        return ServiceResult<int>.Ok(reservation.Id);
    }

    // ---------- Cancel ----------

    public async Task<ServiceResult<int>> CancelAsync(int id, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            db.ChangeTracker.Clear();
            try
            {
                return await TryCancelAsync(id, ct);
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxConcurrencyRetries)
            {
                // a booking touched the same nights at the same time: retry
            }
            catch (DbUpdateConcurrencyException)
            {
                return ServiceResult<int>.Conflict(ApiErrors.ConcurrentChange());
            }
        }
    }

    private async Task<ServiceResult<int>> TryCancelAsync(int id, CancellationToken ct)
    {
        var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (reservation is null)
            return ServiceResult<int>.NotFound(ApiErrors.ReservationNotFound());

        if (reservation.Status != ReservationStatus.Confirmed)
            return ServiceResult<int>.Conflict(ApiErrors.CancelNotConfirmed(reservation.Status));

        // Once the arrival date has passed, a guest who didn't come is a no-show, not a cancellation.
        if (reservation.CheckIn < Today)
            return ServiceResult<int>.Conflict(ApiErrors.CancelAfterArrival());

        // Give the nights back to the inventory.
        var nights = await db.Availability
            .Where(a => a.RoomId == reservation.RoomId && a.Date >= reservation.CheckIn && a.Date < reservation.CheckOut)
            .ToListAsync(ct);
        foreach (var night in nights)
            night.BookedRooms = Math.Max(0, night.BookedRooms - reservation.Rooms);

        reservation.Status = ReservationStatus.Cancelled;
        reservation.CancelledAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return ServiceResult<int>.Ok(reservation.Id);
    }

    // ---------- Status changes (no inventory impact) ----------

    public Task<ServiceResult<int>> CheckInAsync(int id, CancellationToken ct) =>
        ChangeStatusAsync(id, ReservationStatus.CheckedIn, ReservationStatus.Confirmed,
            r => Today < r.CheckIn ? ApiErrors.CheckInBeforeArrival()
                : Today >= r.CheckOut ? ApiErrors.StayOver() : null, ct);

    public Task<ServiceResult<int>> CheckOutAsync(int id, CancellationToken ct) =>
        // Early check-outs are allowed; the remaining nights stay charged (hotel policy), so no release.
        ChangeStatusAsync(id, ReservationStatus.CheckedOut, ReservationStatus.CheckedIn, _ => null, ct);

    public Task<ServiceResult<int>> NoShowAsync(int id, CancellationToken ct) =>
        ChangeStatusAsync(id, ReservationStatus.NoShow, ReservationStatus.Confirmed,
            r => Today < r.CheckIn ? ApiErrors.NoShowBeforeArrival() : null, ct);

    // Simple state machine: each action is allowed from exactly one status, plus a date rule.
    private async Task<ServiceResult<int>> ChangeStatusAsync(
        int id, ReservationStatus target, ReservationStatus requiredCurrent,
        Func<Reservation, ApiError?> dateRule, CancellationToken ct)
    {
        var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (reservation is null)
            return ServiceResult<int>.NotFound(ApiErrors.ReservationNotFound());

        if (reservation.Status != requiredCurrent)
            return ServiceResult<int>.Conflict(ApiErrors.InvalidTransition(reservation.Status, target));

        if (dateRule(reservation) is { } error)
            return ServiceResult<int>.Conflict(error);

        reservation.Status = target;
        await db.SaveChangesAsync(ct);
        return ServiceResult<int>.Ok(reservation.Id);
    }

    // ---------- Helpers ----------

    private ApiError? ValidateStay(DateOnly checkIn, DateOnly checkOut, int rooms)
    {
        if (checkIn == default || checkOut == default)
            return ApiErrors.DatesRequired();
        if (checkIn < Today)
            return ApiErrors.CheckInPast();
        if (checkOut <= checkIn)
            return ApiErrors.CheckOutBeforeCheckIn();
        if (checkOut.DayNumber - checkIn.DayNumber > MaxNights)
            return ApiErrors.TooManyNights(MaxNights);
        if (rooms < 1)
            return ApiErrors.RoomsRequired();
        return null;
    }

    // First night that blocks the booking, as an error the UI can show. Null = bookable.
    private static ApiError? AvailabilityProblem(string typeName, IEnumerable<(DateOnly Date, int? Available)> nights, int rooms)
    {
        foreach (var (date, available) in nights)
        {
            if (available is null)
                return ApiErrors.NoInventory(typeName, date);
            if (available < rooms)
                return available == 0
                    ? ApiErrors.SoldOut(typeName, date)
                    : ApiErrors.OnlyLeft(typeName, date, available.Value);
        }
        return null;
    }

    private Task<RoomInfo?> LoadRoomAsync(int roomId, CancellationToken ct) =>
        db.Rooms
            .AsNoTracking()
            .Where(r => r.Id == roomId)
            .Select(r => new RoomInfo(r.Hotel.Name, r.Hotel.IsActive, r.RoomType.Name, r.RoomType.Capacity, r.BasePrice))
            .FirstOrDefaultAsync(ct);

    private static IEnumerable<DateOnly> EachNight(DateOnly checkIn, DateOnly checkOut)
    {
        for (var d = checkIn; d < checkOut; d = d.AddDays(1))
            yield return d;
    }

    private record RoomInfo(string HotelName, bool HotelIsActive, string TypeName, int Capacity, decimal BasePrice);
}
