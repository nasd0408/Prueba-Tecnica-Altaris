namespace Altairis.Api.Dtos;

// One response with everything the dashboard needs: a single round trip on page load
// instead of one request per widget. It will grow with occupancy/reservation figures.
public record DashboardSummary(
    int TotalHotels,
    int ActiveHotels,
    int Countries,
    int Cities,
    IReadOnlyList<CountItem> HotelsByCountry,
    IReadOnlyList<CountItem> HotelsByStars,
    IReadOnlyList<HotelDto> LatestHotels);

public record CountItem(string Label, int Count);
