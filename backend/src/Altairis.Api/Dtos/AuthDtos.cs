using System.ComponentModel.DataAnnotations;

namespace Altairis.Api.Dtos;

public record LoginRequest([Required] string UserName, [Required] string Password);

public record RefreshRequest([Required] string RefreshToken);

public record RegisterRequest(
    [Required, MaxLength(64)] string UserName,
    [EmailAddress, MaxLength(150)] string? Email,
    [Required] string Password);

public record ResetPasswordRequest([Required] string UserName, [Required] string NewPassword);
