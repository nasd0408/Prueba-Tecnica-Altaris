using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Data;

/// <summary>
/// Demo inventory: one Availability row per room and night for every active hotel,
/// from a week ago to a month ahead (~1.2 million rows). BookedRooms starts at 0:
/// ReservationSeeder creates the bookings and then recalculates the counters from them.
/// </summary>
public static class InventorySeeder
{
    public const int PastDays = 7;
    public const int FutureDays = 30;

    public static DateOnly SeedStart(DateOnly today) => today.AddDays(-PastDays);
    public static int SeedDays => PastDays + FutureDays + 1;

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (await db.Availability.AnyAsync(ct))
            return;

        // Dates are relative to the day the database is created, so the demo always shows
        // "today" with data around it. (Server UTC date; a few hours off in Spain near midnight.)
        var start = SeedStart(DateOnly.FromDateTime(DateTime.UtcNow));
        var days = SeedDays;

        // Why raw SQL here and EF everywhere else: building 1.2M entities in memory and inserting
        // them through EF takes minutes; one INSERT ... SELECT lets SQL Server generate the rows
        // itself in a few seconds. It's seed data, so there's no business logic being bypassed.
        //
        // TotalRooms = the allotment Altairis gets from the hotel for each room type: a few rooms,
        // not the whole hotel (that's how B2B distribution works). CHECKSUM(RoomId) makes it stable
        // per room, so the same room has the same allotment every night, and the same on every machine.
        db.Database.SetCommandTimeout(TimeSpan.FromMinutes(3));
        await db.Database.ExecuteSqlAsync($"""
            WITH Days AS (
                SELECT TOP ({days}) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS N
                FROM sys.all_objects
            )
            INSERT INTO Availability (RoomId, [Date], TotalRooms, BookedRooms, Price)
            SELECT r.Id,
                   DATEADD(day, d.N, {start}),
                   CASE
                       WHEN rt.Name LIKE '%Suite%' THEN 1 + ABS(CHECKSUM(r.Id)) % 2
                       WHEN rt.Capacity = 1 THEN 1 + ABS(CHECKSUM(r.Id)) % 4
                       ELSE 2 + ABS(CHECKSUM(r.Id)) % 7
                   END,
                   0,
                   -- Weekend price (+15%) for 4-5 star hotels, to show daily prices in the grid.
                   -- Days since 1900-01-01 (a Monday) % 7 gives the weekday regardless of the
                   -- server's DATEFIRST setting: 4 = Friday, 5 = Saturday.
                   CASE WHEN h.Stars >= 4 AND DATEDIFF(day, '19000101', DATEADD(day, d.N, {start})) % 7 IN (4, 5)
                        THEN ROUND(r.BasePrice * 1.15, 0) END
            FROM Rooms r
            JOIN Hotels h ON h.Id = r.HotelId
            JOIN RoomTypes rt ON rt.Id = r.RoomTypeId
            CROSS JOIN Days d
            WHERE h.IsActive = 1;
            """, ct);
        db.Database.SetCommandTimeout(null);
    }
}
