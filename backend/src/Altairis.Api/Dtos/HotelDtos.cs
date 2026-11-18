using System.ComponentModel.DataAnnotations;

namespace Altairis.Api.Dtos;

// DTOs instead of exposing the entity directly: the API contract doesn't change every time
// the table does, and the client can't post fields it shouldn't set (Id, CreatedAt...).

public record HotelDto(
    int Id,
    string Name,
    string City,
    string Country,
    string? Address,
    int Stars,
    string? Email,
    string? Phone,
    bool IsActive,
    DateTime CreatedAt);

// Same request for create and update: both need exactly the same fields and rules.
// DataAnnotations are enough here; [ApiController] returns a 400 with the errors automatically.
// If validation rules grew (cross-field, DB lookups) I'd switch to FluentValidation.
public class SaveHotelRequest
{
    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Country { get; set; } = string.Empty;

    [MaxLength(250)]
    public string? Address { get; set; }

    [Range(1, 5)]
    public int Stars { get; set; }

    [EmailAddress, MaxLength(150)]
    public string? Email { get; set; }

    [MaxLength(30)]
    public string? Phone { get; set; }

    public bool IsActive { get; set; } = true;
}

public class HotelQuery
{
    public string? Search { get; set; }
    public string? Country { get; set; }
    public int? Stars { get; set; }
    public bool? IsActive { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}
