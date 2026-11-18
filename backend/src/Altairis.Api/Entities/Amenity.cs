namespace Altairis.Api.Entities;

// Shared catalogue of room features (Wi-Fi, TV, pool access, pet friendly...).
// A catalogue instead of a text field so the client can later filter "rooms with pool access".
public class Amenity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    public List<Room> Rooms { get; set; } = [];
}
