using Altairis.Api.Entities;

namespace Altairis.Api.Errors;

/// <summary>
/// Catalogue of every business error the API can return. The frontend dictionaries
/// (frontend/src/app/core/i18n) have one entry per code under "errors".
/// Keeping them all in one file makes the contract easy to review: adding an error here
/// means adding its translation there.
/// </summary>
public static class ApiErrors
{
    private static Dictionary<string, object?> Args(params (string Key, object? Value)[] values) =>
        values.ToDictionary(v => v.Key, v => v.Value);

    // ---------- Generic ----------

    public static ApiError ValidationFailed(IEnumerable<string> fields) =>
        new("validation.failed", "One or more fields are invalid.", Args(("fields", fields.ToList())));

    public static ApiError RangeRequired() =>
        new("range.required", "'from' and 'to' dates are required (yyyy-MM-dd).");

    public static ApiError RangeOrder() =>
        new("range.order", "'to' must be on or after 'from'.");

    public static ApiError RangeTooLong(int maxDays) =>
        new("range.tooLong", $"The range can't be longer than {maxDays} days.", Args(("maxDays", maxDays)));

    // ---------- Auth ----------

    public static ApiError InvalidCredentials() =>
        new("auth.invalidCredentials", "Incorrect username or password.");

    public static ApiError AccountLocked() =>
        new("auth.locked", "Account temporarily locked. Try again in a few minutes.");

    public static ApiError UserNotFound() =>
        new("auth.userNotFound", "User not found.");

    // Identity's own error codes (PasswordTooShort, DuplicateUserName...) travel in args.codes.
    public static ApiError IdentityFailed(IEnumerable<string> identityCodes, string message) =>
        new("identity.failed", message, Args(("codes", identityCodes.ToList())));

    // ---------- Catalogues and rooms ----------

    public static ApiError DuplicateRoomType(string name) =>
        new("catalogue.duplicateRoomType", $"There is already a room type called \"{name}\".", Args(("name", name)));

    public static ApiError DuplicateAmenity(string name) =>
        new("catalogue.duplicateAmenity", $"There is already an amenity called \"{name}\".", Args(("name", name)));

    public static ApiError RoomTypeNotFound() =>
        new("room.typeNotFound", "The selected room type doesn't exist.");

    public static ApiError AmenityNotFound() =>
        new("room.amenityNotFound", "One or more amenities don't exist.");

    public static ApiError DuplicateRoom(string roomType) =>
        new("room.duplicate", $"This hotel already offers \"{roomType}\" rooms. Edit the existing one instead.",
            Args(("roomType", roomType)));

    // ---------- Availability ----------

    public static ApiError AvailabilityPastDates() =>
        new("availability.pastDates", "Availability can't be changed for past dates.");

    public static ApiError AvailabilityForeignRooms() =>
        new("availability.foreignRooms", "One or more rooms don't belong to this hotel.");

    public static ApiError AvailabilityNoMatchingDays() =>
        new("availability.noMatchingDays", "No dates match the selected days of the week.");

    // examples: the first nights that collide, so the user knows exactly what to fix.
    public static ApiError AvailabilityBelowBooked(int totalRooms, int nights, IEnumerable<(string RoomType, DateOnly Date, int Booked)> examples)
    {
        var list = examples.Select(e => new { roomType = e.RoomType, date = e.Date, booked = e.Booked }).ToList();
        return new("availability.belowBooked",
            $"{totalRooms} rooms is less than what's already booked on {nights} night(s).",
            Args(("totalRooms", totalRooms), ("nights", nights), ("examples", list)));
    }

    // ---------- Reservations ----------

    public static ApiError ReservationNotFound() => new("reservation.notFound", "Reservation not found.");
    public static ApiError RoomNotFound() => new("reservation.roomNotFound", "Room not found.");

    public static ApiError HotelInactive() =>
        new("reservation.hotelInactive", "This hotel is inactive and can't take new bookings.");

    public static ApiError DatesRequired() =>
        new("reservation.datesRequired", "Check-in and check-out dates are required.");

    public static ApiError CheckInPast() => new("reservation.checkInPast", "Check-in can't be in the past.");

    public static ApiError CheckOutBeforeCheckIn() =>
        new("reservation.checkOutBeforeCheckIn", "Check-out must be after check-in.");

    public static ApiError TooManyNights(int max) =>
        new("reservation.tooManyNights", $"Stays are limited to {max} nights.", Args(("max", max)));

    public static ApiError RoomsRequired() => new("reservation.roomsRequired", "Book at least one room.");

    public static ApiError TooManyGuests(int guests, int rooms, string roomType, int max) =>
        new("reservation.tooManyGuests", $"{guests} guests don't fit in {rooms} {roomType} room(s) (max. {max}).",
            Args(("guests", guests), ("rooms", rooms), ("roomType", roomType), ("max", max)));

    public static ApiError NoInventory(string roomType, DateOnly date) =>
        new("reservation.noInventory", $"No {roomType} inventory loaded for {date:dd/MM/yyyy}.",
            Args(("roomType", roomType), ("date", date)));

    public static ApiError SoldOut(string roomType, DateOnly date) =>
        new("reservation.soldOut", $"{roomType} is sold out on {date:dd/MM/yyyy}.",
            Args(("roomType", roomType), ("date", date)));

    public static ApiError OnlyLeft(string roomType, DateOnly date, int available) =>
        new("reservation.onlyLeft", $"Only {available} {roomType} room(s) left on {date:dd/MM/yyyy}.",
            Args(("roomType", roomType), ("date", date), ("available", available)));

    public static ApiError ConcurrentChange() =>
        new("reservation.concurrency", "The availability changed while saving. Please try again.");

    public static ApiError CancelNotConfirmed(ReservationStatus status) =>
        new("reservation.cancelNotConfirmed", $"Only confirmed reservations can be cancelled (this one is {status}).",
            Args(("status", status)));

    public static ApiError CancelAfterArrival() =>
        new("reservation.cancelAfterArrival", "The arrival date has passed: mark it as no-show instead.");

    public static ApiError InvalidTransition(ReservationStatus status, ReservationStatus target) =>
        new("reservation.invalidTransition", $"Can't change a {status} reservation to {target}.",
            Args(("status", status), ("target", target)));

    public static ApiError CheckInBeforeArrival() =>
        new("reservation.checkInBeforeArrival", "The guest can't check in before the arrival date.");

    public static ApiError StayOver() => new("reservation.stayOver", "The stay is already over.");

    public static ApiError NoShowBeforeArrival() =>
        new("reservation.noShowBeforeArrival", "A reservation can only be a no-show from its arrival date.");
}
