using Altairis.Api.Dtos;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Altairis.Api.Auth;

/// <summary>
/// Public auth endpoints, built on ASP.NET Core Identity (UserManager / SignInManager + bearer tokens).
///
/// Why my own controller instead of app.MapIdentityApi(): that maps ~10 endpoints (confirm email,
/// 2FA, manage info...) and its register/reset flows require email codes. For this MVP the client
/// asked for a simpler flow (any user can be created, any password reset without verification),
/// so I expose only the 4 endpoints the frontend uses and nothing else is reachable by accident.
/// Password hashing, lockout and token creation are still Identity's, not hand-written.
/// </summary>
[ApiController]
[Route("api/auth")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.Auth)] // these are the only endpoints usable without a token
public class AuthController(
    UserManager<IdentityUser> users,
    SignInManager<IdentityUser> signInManager,
    IOptionsMonitor<BearerTokenOptions> bearerOptions,
    TimeProvider time) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        // With the bearer scheme, a successful sign-in makes Identity write the token response
        // itself: { tokenType, accessToken, expiresIn, refreshToken }. Same format as MapIdentityApi.
        signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;

        // lockoutOnFailure: after 5 wrong passwords the account is locked for 5 minutes
        // (Identity defaults). Together with the rate limiter this slows down brute force.
        var result = await signInManager.PasswordSignInAsync(
            request.UserName.Trim(), request.Password, isPersistent: false, lockoutOnFailure: true);

        if (result.IsLockedOut)
            return Problem("Account temporarily locked. Try again in a few minutes.", statusCode: StatusCodes.Status423Locked);

        if (!result.Succeeded)
            return Problem("Incorrect username or password.", statusCode: StatusCodes.Status401Unauthorized);

        return new EmptyResult(); // body already written by the bearer handler
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshRequest request)
    {
        // Same logic as Identity's /refresh endpoint: the refresh token is a protected ticket;
        // if it's valid, not expired and the user's security stamp hasn't changed, issue new tokens.
        // A password reset changes the security stamp, so old refresh tokens stop working.
        var protector = bearerOptions.Get(IdentityConstants.BearerScheme).RefreshTokenProtector;
        var ticket = protector.Unprotect(request.RefreshToken);

        if (ticket?.Properties.ExpiresUtc is not { } expiresUtc
            || time.GetUtcNow() >= expiresUtc
            || await signInManager.ValidateSecurityStampAsync(ticket.Principal) is not { } user)
        {
            return Unauthorized();
        }

        var principal = await signInManager.CreateUserPrincipalAsync(user);
        return SignIn(principal, IdentityConstants.BearerScheme);
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var user = new IdentityUser
        {
            UserName = request.UserName.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
        };

        // CreateAsync validates the user name (unique, allowed chars) and the password policy.
        var result = await users.CreateAsync(user, request.Password);
        return result.Succeeded ? StatusCode(StatusCodes.Status201Created) : IdentityProblem(result);
    }

    // MVP behaviour agreed with the client: anyone can set a new password for any user, with no
    // email/SMS verification. The frontend warns that MFA is pending. In a real system this
    // endpoint would require a one-time code sent to the user (that's what Identity's
    // GeneratePasswordResetTokenAsync is designed for: here we generate and consume it in one go).
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var user = await users.FindByNameAsync(request.UserName.Trim());
        if (user is null)
            return Problem("User not found.", statusCode: StatusCodes.Status404NotFound);

        // Going through the reset token (instead of RemovePassword + AddPassword) means Identity
        // validates the new password, updates the security stamp (old sessions can't refresh)
        // and clears any lockout, exactly like a real reset would.
        var token = await users.GeneratePasswordResetTokenAsync(user);
        var result = await users.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
            return IdentityProblem(result);

        await users.SetLockoutEndDateAsync(user, null);
        return NoContent();
    }

    // Identity errors -> standard 400 ValidationProblem, the same shape as DataAnnotations errors,
    // so the frontend handles both with one function.
    private IActionResult IdentityProblem(IdentityResult result)
    {
        foreach (var error in result.Errors)
            ModelState.AddModelError(error.Code, error.Description);
        return ValidationProblem(ModelState);
    }
}
