using System.ComponentModel.DataAnnotations;

namespace Altairis.Api.Dtos;

public record AmenityRef(int Id, string Name);

// Flattened for the UI: the room type's name and capacity travel with the room,
// so the hotel page doesn't need to cross-reference the catalogue to render the table.
public record RoomDto(
    int Id,
    int HotelId,
    int RoomTypeId,
    string RoomTypeName,
    int Capacity,
    decimal BasePrice,
    IReadOnlyList<AmenityRef> Amenities);

public class SaveRoomRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Select a room type.")]
    public int RoomTypeId { get; set; }

    [Range(0, 99_999_999)]
    public decimal BasePrice { get; set; }

    // The full set of amenities for the room (not a diff): the API replaces whatever was there.
    // Simple for the client (send the checked boxes) and idempotent.
    public List<int> AmenityIds { get; set; } = [];
}
