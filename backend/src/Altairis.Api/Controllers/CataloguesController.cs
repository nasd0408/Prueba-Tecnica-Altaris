using Altairis.Api.Data;
using Altairis.Api.Dtos;
using Altairis.Api.Entities;
using Altairis.Api.Errors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Controllers;

// Both catalogues (room types and amenities) in one controller: same shape (small list,
// create, rename) and no business logic. If they grew apart they'd get a controller each.
// No DELETE: rooms reference these entries (and reservations will). Fixing a mistake = editing.
[ApiController]
[Route("api")]
public class CataloguesController(AppDbContext db) : ControllerBase
{
    // ---------- Room types ----------

    [HttpGet("room-types")]
    public async Task<ActionResult<List<RoomTypeDto>>> GetRoomTypes(CancellationToken ct) =>
        await db.RoomTypes
            .AsNoTracking()
            .OrderBy(t => t.Capacity)
            .ThenBy(t => t.Name)
            .Select(t => new RoomTypeDto(t.Id, t.Name, t.Description, t.Capacity, t.Rooms.Count))
            .ToListAsync(ct);

    [HttpPost("room-types")]
    public async Task<ActionResult<RoomTypeDto>> CreateRoomType(SaveRoomTypeRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        if (await db.RoomTypes.AnyAsync(t => t.Name == name, ct))
            return this.Error(StatusCodes.Status409Conflict, ApiErrors.DuplicateRoomType(name));

        var type = new RoomType();
        Apply(request, type);
        db.RoomTypes.Add(type);
        await db.SaveChangesAsync(ct);

        return StatusCode(StatusCodes.Status201Created, new RoomTypeDto(type.Id, type.Name, type.Description, type.Capacity, 0));
    }

    [HttpPut("room-types/{id:int}")]
    public async Task<ActionResult<RoomTypeDto>> UpdateRoomType(int id, SaveRoomTypeRequest request, CancellationToken ct)
    {
        var type = await db.RoomTypes.FindAsync([id], ct);
        if (type is null)
            return NotFound();

        var name = request.Name.Trim();
        if (await db.RoomTypes.AnyAsync(t => t.Name == name && t.Id != id, ct))
            return this.Error(StatusCodes.Status409Conflict, ApiErrors.DuplicateRoomType(name));

        // Note: lowering the capacity affects every hotel that offers this type. Acceptable for
        // the MVP (it's an admin catalogue); with reservations in place it would need a check.
        Apply(request, type);
        await db.SaveChangesAsync(ct);

        var roomCount = await db.Rooms.CountAsync(r => r.RoomTypeId == id, ct);
        return new RoomTypeDto(type.Id, type.Name, type.Description, type.Capacity, roomCount);
    }

    // ---------- Amenities ----------

    [HttpGet("amenities")]
    public async Task<ActionResult<List<AmenityDto>>> GetAmenities(CancellationToken ct) =>
        await db.Amenities
            .AsNoTracking()
            .OrderBy(a => a.Name)
            .Select(a => new AmenityDto(a.Id, a.Name, a.Rooms.Count))
            .ToListAsync(ct);

    [HttpPost("amenities")]
    public async Task<ActionResult<AmenityDto>> CreateAmenity(SaveAmenityRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        if (await db.Amenities.AnyAsync(a => a.Name == name, ct))
            return this.Error(StatusCodes.Status409Conflict, ApiErrors.DuplicateAmenity(name));

        var amenity = new Amenity { Name = name };
        db.Amenities.Add(amenity);
        await db.SaveChangesAsync(ct);

        return StatusCode(StatusCodes.Status201Created, new AmenityDto(amenity.Id, amenity.Name, 0));
    }

    [HttpPut("amenities/{id:int}")]
    public async Task<ActionResult<AmenityDto>> UpdateAmenity(int id, SaveAmenityRequest request, CancellationToken ct)
    {
        var amenity = await db.Amenities.FindAsync([id], ct);
        if (amenity is null)
            return NotFound();

        var name = request.Name.Trim();
        if (await db.Amenities.AnyAsync(a => a.Name == name && a.Id != id, ct))
            return this.Error(StatusCodes.Status409Conflict, ApiErrors.DuplicateAmenity(name));

        amenity.Name = name;
        await db.SaveChangesAsync(ct);

        var roomCount = await db.Rooms.CountAsync(r => r.Amenities.Any(a => a.Id == id), ct);
        return new AmenityDto(amenity.Id, amenity.Name, roomCount);
    }

    private static void Apply(SaveRoomTypeRequest r, RoomType t)
    {
        t.Name = r.Name.Trim();
        t.Description = string.IsNullOrWhiteSpace(r.Description) ? null : r.Description.Trim();
        t.Capacity = r.Capacity;
    }
}
