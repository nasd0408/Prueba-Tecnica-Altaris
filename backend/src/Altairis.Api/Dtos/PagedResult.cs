namespace Altairis.Api.Dtos;

// Generic so the same shape is reused by every paged list (hotels now, reservations later).
// TotalCount lets the client show "page X of Y" without asking for everything.
public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
}
