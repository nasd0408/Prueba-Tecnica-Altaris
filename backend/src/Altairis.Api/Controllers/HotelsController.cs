using Altairis.Api.Data;
using Altairis.Api.Dtos;
using Altairis.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altairis.Api.Controllers;

// The controller talks to the DbContext directly, no repository/service layer.
// DbContext already is a unit of work + repository, and wrapping it for simple CRUD only adds files.
// When real business rules show up (reservations vs availability) that logic goes to a service.
[ApiController]
[Route("api/hotels")]
public class HotelsController(AppDbContext db) : ControllerBase
{
    private const int MaxPageSize = 100;

    [HttpGet]
    public async Task<ActionResult<PagedResult<HotelDto>>> GetHotels([FromQuery] HotelQuery query, CancellationToken ct)
    {
        // Clamp paging values: the client must never be able to ask for "page size 1,000,000".
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // AsNoTracking: read-only list, no need for EF to keep snapshots of every row.
        var hotels = db.Hotels.AsNoTracking();

        // Filters are composed on the IQueryable, so everything ends up as a single SQL query.
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            hotels = hotels.Where(h => h.Name.Contains(term) || h.City.Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(query.Country))
            hotels = hotels.Where(h => h.Country == query.Country);

        if (query.Stars is not null)
            hotels = hotels.Where(h => h.Stars == query.Stars);

        if (query.IsActive is not null)
            hotels = hotels.Where(h => h.IsActive == query.IsActive);

        var total = await hotels.CountAsync(ct);

        // Offset paging (Skip/Take). Simple and lets the user jump to any page.
        // Its cost grows with the page number; with much bigger tables I'd consider keyset paging,
        // but nobody browses to page 400 of a hotel list - they search.
        var items = await hotels
            .OrderBy(h => h.Name)
            .ThenBy(h => h.Id) // tie-breaker so paging is stable
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(h => ToDto(h))
            .ToListAsync(ct);

        return new PagedResult<HotelDto>(items, page, pageSize, total);
    }

    // Small helper endpoint for the country dropdown in the UI.
    [HttpGet("countries")]
    public async Task<ActionResult<List<string>>> GetCountries(CancellationToken ct) =>
        await db.Hotels.Select(h => h.Country).Distinct().OrderBy(c => c).ToListAsync(ct);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<HotelDto>> GetHotel(int id, CancellationToken ct)
    {
        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(h => h.Id == id, ct);
        return hotel is null ? NotFound() : ToDto(hotel);
    }

    [HttpPost]
    public async Task<ActionResult<HotelDto>> CreateHotel(SaveHotelRequest request, CancellationToken ct)
    {
        var hotel = new Hotel { CreatedAt = DateTime.UtcNow };
        Apply(request, hotel);

        db.Hotels.Add(hotel);
        await db.SaveChangesAsync(ct);

        // 201 + Location header pointing to the new resource (REST convention).
        return CreatedAtAction(nameof(GetHotel), new { id = hotel.Id }, ToDto(hotel));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<HotelDto>> UpdateHotel(int id, SaveHotelRequest request, CancellationToken ct)
    {
        var hotel = await db.Hotels.FindAsync([id], ct);
        if (hotel is null)
            return NotFound();

        Apply(request, hotel);
        await db.SaveChangesAsync(ct);
        return ToDto(hotel);
    }

    // Manual mapping instead of AutoMapper: a handful of fields, explicit and easy to debug.
    private static void Apply(SaveHotelRequest r, Hotel h)
    {
        h.Name = r.Name.Trim();
        h.City = r.City.Trim();
        h.Country = r.Country.Trim();
        h.Address = r.Address?.Trim();
        h.Stars = r.Stars;
        h.Email = r.Email?.Trim();
        h.Phone = r.Phone?.Trim();
        h.IsActive = r.IsActive;
    }

    private static HotelDto ToDto(Hotel h) =>
        new(h.Id, h.Name, h.City, h.Country, h.Address, h.Stars, h.Email, h.Phone, h.IsActive, h.CreatedAt);
}
