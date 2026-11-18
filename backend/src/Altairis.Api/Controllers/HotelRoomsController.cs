using Altairis.Api.Data;
using Altairis.Api.Dtos;
using Altairis.Api.Entities;
using Altairis.Api.Errors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Controllers;

// Nested route (/api/hotels/{hotelId}/rooms): a room only exists inside a hotel, and the URL
// says so. Every action checks the room really belongs to that hotel, so
// /hotels/1/rooms/999 can't touch a room of hotel 2.
[ApiController]
[Route("api/hotels/{hotelId:int}/rooms")]
public class HotelRoomsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<RoomDto>>> GetRooms(int hotelId, CancellationToken ct)
    {
        // 404 for an unknown hotel instead of an empty list: an empty list would hide a wrong id.
        if (!await db.Hotels.AnyAsync(h => h.Id == hotelId, ct))
            return NotFound();

        // No paging: a hotel offers a handful of room types, never thousands.
        // The projection includes the amenities sub-list; EF turns it into a single query.
        return await db.Rooms
            .AsNoTracking()
            .Where(r => r.HotelId == hotelId)
            .OrderBy(r => r.BasePrice)
            .ThenBy(r => r.RoomType.Name)
            .Select(r => new RoomDto(
                r.Id, r.HotelId, r.RoomTypeId, r.RoomType.Name, r.RoomType.Capacity, r.BasePrice,
                r.Amenities.OrderBy(a => a.Name).Select(a => new AmenityRef(a.Id, a.Name)).ToList()))
            .ToListAsync(ct);
    }

    [HttpPost]
    public async Task<ActionResult<RoomDto>> CreateRoom(int hotelId, SaveRoomRequest request, CancellationToken ct)
    {
        if (!await db.Hotels.AnyAsync(h => h.Id == hotelId, ct))
            return NotFound();

        if (await Validate(hotelId, request, excludeRoomId: null, ct) is { } problem)
            return problem;

        var room = new Room
        {
            HotelId = hotelId,
            RoomTypeId = request.RoomTypeId,
            BasePrice = request.BasePrice,
            Amenities = await LoadAmenities(request.AmenityIds, ct),
            CreatedAt = DateTime.UtcNow,
        };

        db.Rooms.Add(room);
        await db.SaveChangesAsync(ct);

        return StatusCode(StatusCodes.Status201Created, await GetDto(room.Id, ct));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<RoomDto>> UpdateRoom(int hotelId, int id, SaveRoomRequest request, CancellationToken ct)
    {
        // Include the current amenities: EF needs them loaded to work out which link rows
        // to delete and which to insert when the list is replaced.
        var room = await db.Rooms
            .Include(r => r.Amenities)
            .FirstOrDefaultAsync(r => r.Id == id && r.HotelId == hotelId, ct);
        if (room is null)
            return NotFound();

        if (await Validate(hotelId, request, excludeRoomId: id, ct) is { } problem)
            return problem;

        room.RoomTypeId = request.RoomTypeId;
        room.BasePrice = request.BasePrice;
        room.Amenities = await LoadAmenities(request.AmenityIds, ct);
        await db.SaveChangesAsync(ct);

        return await GetDto(room.Id, ct);
    }

    // No DELETE yet: availability and reservations will point to rooms. Removing one needs rules
    // (no future bookings, archive instead...) that belong to a later iteration.

    // Rules that need the database (DataAnnotations can't check them):
    // the room type must exist, the hotel can't offer it twice, all amenity ids must exist.
    private async Task<ActionResult?> Validate(int hotelId, SaveRoomRequest request, int? excludeRoomId, CancellationToken ct)
    {
        var roomType = await db.RoomTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == request.RoomTypeId, ct);
        if (roomType is null)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.RoomTypeNotFound());

        if (await db.Rooms.AnyAsync(r => r.HotelId == hotelId && r.RoomTypeId == request.RoomTypeId && r.Id != excludeRoomId, ct))
            return this.Error(StatusCodes.Status409Conflict, ApiErrors.DuplicateRoom(roomType.Name));

        var ids = request.AmenityIds.Distinct().ToList();
        if (ids.Count > 0 && await db.Amenities.CountAsync(a => ids.Contains(a.Id), ct) != ids.Count)
            return this.Error(StatusCodes.Status400BadRequest, ApiErrors.AmenityNotFound());

        return null;
    }

    private async Task<List<Amenity>> LoadAmenities(List<int> ids, CancellationToken ct)
    {
        var distinct = ids.Distinct().ToList();
        return distinct.Count == 0 ? [] : await db.Amenities.Where(a => distinct.Contains(a.Id)).ToListAsync(ct);
    }

    // Re-read through the same projection as the list, so POST/PUT return exactly what GET shows.
    private async Task<RoomDto> GetDto(int id, CancellationToken ct) =>
        await db.Rooms
            .AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new RoomDto(
                r.Id, r.HotelId, r.RoomTypeId, r.RoomType.Name, r.RoomType.Capacity, r.BasePrice,
                r.Amenities.OrderBy(a => a.Name).Select(a => new AmenityRef(a.Id, a.Name)).ToList()))
            .FirstAsync(ct);
}
