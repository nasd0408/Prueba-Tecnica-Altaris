using Altairis.Api.Errors;
using Microsoft.AspNetCore.Mvc;

namespace Altairis.Api.Services;

/// <summary>
/// Outcome of a business operation: either a value or an error with the HTTP status that fits it.
/// Why not exceptions for business errors: "only 2 rooms left" is an expected answer, not an
/// exceptional situation, and returning it keeps the service free of HTTP types while the
/// controller stays a thin translation layer.
/// </summary>
public record ServiceResult<T>(T? Value, int Status, ApiError? Error)
{
    public bool Succeeded => Error is null;

    public static ServiceResult<T> Ok(T value) => new(value, StatusCodes.Status200OK, null);
    public static ServiceResult<T> NotFound(ApiError error) => new(default, StatusCodes.Status404NotFound, error);
    public static ServiceResult<T> Invalid(ApiError error) => new(default, StatusCodes.Status400BadRequest, error);
    public static ServiceResult<T> Conflict(ApiError error) => new(default, StatusCodes.Status409Conflict, error);
}

public static class ServiceResultExtensions
{
    // Errors become ProblemDetails with code + args, the same shape as every other API error,
    // so the frontend translates them with the same helper.
    public static ActionResult<T> ToActionResult<T>(this ControllerBase controller, ServiceResult<T> result) =>
        result.Succeeded ? result.Value! : controller.Error(result.Status, result.Error!);
}
