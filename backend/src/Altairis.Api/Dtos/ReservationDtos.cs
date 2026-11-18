using System.ComponentModel.DataAnnotations;
using Altairis.Api.Entities;
using Altairis.Api.Errors;

namespace Altairis.Api.Dtos;

public record ReservationListItemDto(
    int Id,
    string Code,
    int HotelId,
    string HotelName,
    string City,
    string RoomTypeName,
    string GuestName,
    DateOnly CheckIn,
    DateOnly CheckOut,
    int Nights,
    int Rooms,
    int Guests,
    decimal TotalPrice,
    ReservationStatus Status,
    DateTime CreatedAt);

public record ReservationDto(
    int Id,
    string Code,
    int HotelId,
    string HotelName,
    string City,
    string Country,
    int RoomId,
    string RoomTypeName,
    int Capacity,
    DateOnly CheckIn,
    DateOnly CheckOut,
    int Nights,
    int Rooms,
    int Guests,
    string GuestName,
    string GuestEmail,
    string? GuestPhone,
    string? Notes,
    decimal TotalPrice,
    ReservationStatus Status,
    DateTime CreatedAt,
    string? CreatedBy,
    DateTime? CancelledAt);

public class CreateReservationRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Select a room.")]
    public int RoomId { get; set; }

    public DateOnly CheckIn { get; set; }
    public DateOnly CheckOut { get; set; }

    [Range(1, 20)]
    public int Rooms { get; set; } = 1;

    [Range(1, 100)]
    public int Guests { get; set; } = 1;

    [Required, MaxLength(150)]
    public string GuestName { get; set; } = string.Empty;

    // Required: it's where the hotel and Altairis send the confirmation.
    [Required, EmailAddress, MaxLength(150)]
    public string GuestEmail { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? GuestPhone { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
}

// Answer to "can I book this, and how much is it?" before creating the reservation.
public record QuoteNightDto(DateOnly Date, int? Available, decimal Price);

public record QuoteDto(
    int RoomId,
    string HotelName,
    string RoomTypeName,
    int Capacity,
    DateOnly CheckIn,
    DateOnly CheckOut,
    int Nights,
    int Rooms,
    int MaxGuests,
    decimal TotalPrice,
    bool CanBook,
    ApiError? Problem, // same code + args as an API error, so the UI translates it the same way
    IReadOnlyList<QuoteNightDto> NightsDetail);

public class ReservationQuery
{
    // Code ("ALT-1000123"), guest name or hotel name.
    public string? Search { get; set; }
    public ReservationStatus? Status { get; set; }
    public int? HotelId { get; set; }

    // Which date From/To apply to: checkIn (arrivals), checkOut (departures),
    // stay (any night inside the range) or created (booking date).
    public string? DateType { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}

// ---------- Daily operations ----------

public record CountryActivityDto(string Country, int Arrivals, int Departures, int InHouse);

public record DailySummaryDto(
    DateOnly Date,
    int Arrivals,
    int ArrivalsPending,
    int Departures,
    int DeparturesPending,
    int InHouse,
    int NewBookings,
    decimal NewBookingsRevenue,
    int Cancellations,
    IReadOnlyList<CountryActivityDto> ByCountry);
