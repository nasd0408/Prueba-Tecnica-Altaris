using System.ComponentModel.DataAnnotations;

namespace Altairis.Api.Dtos;

// ---------- Hotel grid ----------

// Price is the effective price for the night (override or base price); PriceOverridden tells the UI
// which one it is, so it can highlight special prices.
public record AvailabilityDayDto(
    DateOnly Date,
    int TotalRooms,
    int BookedRooms,
    int AvailableRooms,
    decimal Price,
    bool PriceOverridden);

// Days is "dense": one entry per date of the range, in order, null where no inventory was loaded.
// The UI can then render column i of every row without matching dates itself.
public record RoomAvailabilityDto(
    int RoomId,
    string RoomTypeName,
    decimal BasePrice,
    IReadOnlyList<AvailabilityDayDto?> Days);

public record AvailabilityGridDto(DateOnly From, DateOnly To, IReadOnlyList<RoomAvailabilityDto> Rooms);

// ---------- Bulk load ----------

public class BulkAvailabilityRequest
{
    [MinLength(1, ErrorMessage = "Select at least one room.")]
    public List<int> RoomIds { get; set; } = [];

    public DateOnly From { get; set; }
    public DateOnly To { get; set; }

    // Optional filter, e.g. only Fridays and Saturdays. Empty = every day of the range.
    // DayOfWeek serialises as a number (0 = Sunday), the same as JavaScript's Date.getDay().
    public List<DayOfWeek> DaysOfWeek { get; set; } = [];

    [Range(0, 1000)]
    public int TotalRooms { get; set; }

    // Null = keep the current price (new nights use the base price). ResetPrice = go back to base price.
    [Range(0, 99_999_999)]
    public decimal? Price { get; set; }

    public bool ResetPrice { get; set; }
}

public record BulkAvailabilityResult(int Created, int Updated);

// ---------- Global overview ----------

public record InventoryDayDto(DateOnly Date, int TotalRooms, int BookedRooms, int SoldOutRooms);

public record TightHotelDto(
    int HotelId,
    string Name,
    string City,
    string Country,
    int TotalRoomNights,
    int BookedRoomNights,
    double Occupancy);

public record InventoryOverviewDto(
    DateOnly From,
    DateOnly To,
    int TotalRoomNights,
    int BookedRoomNights,
    int SoldOutRoomNights,
    IReadOnlyList<InventoryDayDto> Days,
    IReadOnlyList<TightHotelDto> TightestHotels);
