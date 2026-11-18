namespace Altairis.Api.Entities;

// Inventory of one room (hotel + room type) for one night: how many rooms are on sale,
// how many are already booked, and optionally a price for that night.
// One row per room per night is the standard hotel inventory model: every question the operation
// asks ("what's free on the 14th?", "occupancy next week?") is a filter + SUM over these rows.
public class Availability
{
    public int Id { get; set; }

    public int RoomId { get; set; }
    public Room Room { get; set; } = null!;

    // DateOnly, not DateTime: a hotel night is a calendar date, with no time or time zone.
    public DateOnly Date { get; set; }

    // Rooms of this type the hotel puts on sale that night (0 = closed / stop sell).
    public int TotalRooms { get; set; }

    // Denormalised counter, kept by the reservation logic inside the same transaction.
    // Reading a number is much cheaper than counting overlapping reservations for every cell
    // of the grid; the price is that writes must keep it in sync (done in one place only).
    public int BookedRooms { get; set; }

    // Null = use the room's BasePrice. Lets the hotel raise weekends or high season
    // without touching the base price.
    public decimal? Price { get; set; }

    // Optimistic concurrency token (SQL Server rowversion). Two bookings reading the same row
    // can't both save: the second gets a concurrency error instead of overbooking.
    public byte[] RowVersion { get; set; } = [];
}
