namespace Altairis.Api.Entities;

// What a hotel actually sells: one room type from the catalogue, with this hotel's own price
// and amenities. It's the link between Hotel and RoomType (many-to-many with data of its own),
// and the entity that availability and reservations will point to.
public class Room
{
    public int Id { get; set; }

    public int HotelId { get; set; }
    public Hotel Hotel { get; set; } = null!;

    public int RoomTypeId { get; set; }
    public RoomType RoomType { get; set; } = null!;

    // Reference price per night. decimal, never double, for money (no rounding surprises).
    // Daily prices can override it in the availability table later.
    public decimal BasePrice { get; set; }

    // Many-to-many with Amenity. EF creates and manages the join table (RoomAmenities) itself:
    // it only holds the two keys, so a separate entity class would add nothing.
    public List<Amenity> Amenities { get; set; } = [];

    public List<Availability> Availability { get; set; } = [];
    public List<Reservation> Reservations { get; set; } = [];

    public DateTime CreatedAt { get; set; }
}
