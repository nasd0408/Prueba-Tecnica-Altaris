namespace Altairis.Api.Entities;

public class Hotel
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string? Address { get; set; }

    // Kept as a plain int (1-5) instead of an enum: it's a rating, not a set of named states,
    // and it makes range filters ("3 stars or more") trivial if the client asks for them.
    public int Stars { get; set; }

    public string? Email { get; set; }
    public string? Phone { get; set; }

    // Soft "disable" instead of deleting: once reservations exist (later on) a hotel can't
    // just disappear from the history, so deactivation is the safer default for a backoffice.
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }

    public List<Room> Rooms { get; set; } = [];
}
