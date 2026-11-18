using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace Altairis.Api.Errors;

/// <summary>
/// A business error as the API returns it: a stable machine code, the values that go inside the
/// message, and an English text for logs and API consumers.
///
/// Why codes and not translated messages: the API doesn't need to know the user's language.
/// The frontend has a dictionary with the same codes and builds the message in English or Spanish,
/// formatting dates and numbers for the user's locale. The code is the contract; the English
/// Message can be reworded without breaking anything.
/// </summary>
public sealed record ApiError(string Code, string Message, IReadOnlyDictionary<string, object?>? Args = null);

public static class ApiErrorResults
{
    // Every error leaves the API as ProblemDetails (RFC 9457), with the code and args as extensions:
    // { "status": 409, "detail": "Double is sold out on 29/11/2026.", "code": "reservation.soldOut",
    //   "args": { "roomType": "Double", "date": "2026-11-29" } }
    public static ObjectResult Error(this ControllerBase controller, int status, ApiError error)
    {
        var factory = controller.HttpContext.RequestServices.GetRequiredService<ProblemDetailsFactory>();
        var problem = factory.CreateProblemDetails(controller.HttpContext, status, detail: error.Message);
        problem.Extensions["code"] = error.Code;
        if (error.Args is { Count: > 0 })
            problem.Extensions["args"] = error.Args;

        return new ObjectResult(problem) { StatusCode = status };
    }
}
