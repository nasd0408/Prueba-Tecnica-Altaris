namespace Altairis.Api.Entities;

// Shared catalogue of room kinds (Single, Double, Suite...), the same list for every hotel.
// Keeping it as a catalogue instead of free text per hotel means "Double" is the same thing
// everywhere, so reports can compare hotels ("occupancy of Doubles in Spain") without
// fighting spelling variants like "double", "Doble", "DBL".
public class RoomType
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Standard max guests for this kind of room. Used later to validate reservations.
    public int Capacity { get; set; }

    public List<Room> Rooms { get; set; } = [];
}
