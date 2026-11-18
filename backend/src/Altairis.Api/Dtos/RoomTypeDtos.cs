using System.ComponentModel.DataAnnotations;

namespace Altairis.Api.Dtos;

// RoomCount: how many hotels offer this type. Shown in the catalogue screen so the user sees
// the impact before renaming a type that hundreds of hotels use.
public record RoomTypeDto(int Id, string Name, string? Description, int Capacity, int RoomCount);

public class SaveRoomTypeRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Range(1, 20)]
    public int Capacity { get; set; }
}

public record AmenityDto(int Id, string Name, int RoomCount);

public class SaveAmenityRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;
}
