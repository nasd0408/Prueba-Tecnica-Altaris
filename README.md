# Altairis Backoffice

MVP of an operations backoffice for Viajes Altairis: hotel catalogue, room types, availability and reservations.

## Run it

Requirements: Docker (with Docker Compose).

```bash
docker compose up --build
```

- Frontend: http://localhost:4200
- API: http://localhost:5080/api/hotels
- SQL Server: `localhost,1433` (user `sa`, password in `docker-compose.yml`)

Demo user: **demo2026 / demo2026** (created on startup).

The first start takes about a minute and a half: SQL Server has to initialise, then the API applies the
migrations and seeds the demo data (10,000 hotels, ~35k rooms, ~1.2M inventory nights, ~440k reservations).
Later starts reuse the data and take a few seconds. Data is kept in the `sqldata` volume; `docker compose down -v` resets it.

## Stack

| Part     | Tech                                                    |
|----------|---------------------------------------------------------|
| Backend  | .NET 10, ASP.NET Core Web API (controllers), EF Core 10 |
| Database | SQL Server 2022 Express                                 |
| Frontend | Angular 21 (standalone components, signals), axios, Chart.js, plain CSS, EN/ES i18n |
| Infra    | Docker Compose, nginx serving the SPA and proxying `/api` |

## Project structure

```
backend/   Altairis.sln + src/Altairis.Api (entities, EF Core context/migrations, controllers)
frontend/  Angular app (core/ = models and API services, features/ = one folder per screen)
docker-compose.yml
```

## Local development (without Docker for API/frontend)

```bash
docker compose up db                       # only the database
cd backend/src/Altairis.Api && dotnet run  # API on http://localhost:5160
cd frontend && npm install && npm start    # http://localhost:4200, /api proxied to the API
```

## Design notes

- **One API project.** For an MVP of this size, splitting into Domain/Application/Infrastructure projects
  is mostly ceremony. Folders already separate concerns; business logic that grows (e.g. reservations
  vs. availability) moves to services first.
- **Large lists are paged and filtered on the server.** The hotel list never downloads the whole table:
  search, filters and paging are translated into one SQL query, with indexes for the default sort and filters.
- **Room types and amenities are shared catalogues** (Single, Double, Suite... / Wi-Fi, TV, pool access...),
  so "Double" means the same in every hotel and reports can compare them. What a hotel sells is a **Room**:
  hotel + room type + its own price + its amenities (many-to-many through `RoomAmenities`).
  A hotel offers each room type once (unique hotel + room type). Nothing in this chain can be deleted yet:
  availability and reservations will reference rooms, so removing one needs rules first.
- **Inventory = one row per room and night** (`Availability`: rooms on sale, booked, optional price).
  `BookedRooms` is a denormalised counter (cheap to read in grids and reports) protected by a check constraint
  (`booked <= on sale`) and a `rowversion` for optimistic concurrency, ready for reservations.
  Hotels load it in bulk (date range + days of week); lowering below what's booked is rejected with the exact nights.
- **Reservations hold rooms per night** (`[CheckIn, CheckOut)`): booking checks and takes every night of the stay
  in one `SaveChanges` (all or nothing), cancelling gives them back. Two people booking the last room at the same
  time can't both succeed: the `rowversion` makes the second save fail, the service retries with fresh data and
  answers "sold out". The total price is frozen at booking time. Business rules live in `ReservationService`;
  status changes (check-in, check-out, no-show, cancel) are explicit actions with their own rules.
- **Booking starts from availability, not from guessed dates.** The booking form shows a two-month calendar for
  the chosen room type with free rooms and price per night (same data as the inventory grid). The user clicks the
  check-in and then the check-out; the calendar only allows stays where every night has enough rooms (the check-out
  day itself isn't slept, so it can be a full day) and the quote updates as soon as the range is complete.
- **Demo inventory (~1.2M rows) and reservations (~440k) are seeded with set-based SQL** instead of EF: generating that many
  entities in memory would take minutes. Data is relative to the day the DB is created (a week back, a month ahead).
  The inventory counters are then recalculated from the reservations, so both always match.
- **Filters live in the URL** (`/hotels?country=Spain&page=3`), so refresh, back button and sharing links work.
- **Migrations + seed run on API startup** to keep "one command" setup. In production migrations would be a
  separate deployment step.
- **Authentication with ASP.NET Core Identity + bearer tokens.** Login returns an access token (1h) and a
  refresh token; the frontend's axios interceptors attach the token and refresh it transparently on a 401.
  All API controllers require auth by default; only `/api/auth/*` is public, and it's rate limited
  (10 requests/minute per IP) on top of Identity's account lockout. No roles yet: every user can do everything.
- **i18n (English / Spanish).** The API never sends translated text: every error is ProblemDetails with a stable
  `code` and its `args` (e.g. `reservation.soldOut` + `{ roomType, date }`), plus an English `detail` for logs.
  The catalogue is `Errors/ApiErrors.cs`. The frontend has typed dictionaries (`core/i18n/en.ts`, `es.ts`; a key
  missing in Spanish doesn't compile) and builds messages in the user's language, formatting dates, numbers and
  money with Angular's `LOCALE_ID`. The language is chosen at startup (saved choice or browser language);
  switching reloads the app because `LOCALE_ID` can't change at runtime. Catalogue *data* (room type and amenity
  names, countries) is shown as stored; translating it would need translation tables.
- **Data Protection keys are stored in SQL Server**, so tokens survive API restarts/redeploys and would work
  across several API instances.
- **MVP shortcuts in auth (on purpose):** registration and password reset have no verification step
  (no MFA, email or SMS code) - any user can be created and any user's password can be reset. The UI warns
  about it. Next step would be a one-time code before reset, using Identity's reset tokens.
- **Same origin for frontend and API** (nginx proxy in Docker, Angular proxy in dev): no CORS config and
  no per-environment API URLs in the frontend build.
