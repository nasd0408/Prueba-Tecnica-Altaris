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

The first start takes a bit longer: SQL Server has to initialise, then the API applies the migrations
and seeds ~10,000 demo hotels. Data is kept in the `sqldata` volume; `docker compose down -v` resets it.

## Stack

| Part     | Tech                                                    |
|----------|---------------------------------------------------------|
| Backend  | .NET 10, ASP.NET Core Web API (controllers), EF Core 10 |
| Database | SQL Server 2022 Express                                 |
| Frontend | Angular 21 (standalone components, signals), axios, Chart.js, plain CSS |
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
- **Filters live in the URL** (`/hotels?country=Spain&page=3`), so refresh, back button and sharing links work.
- **Migrations + seed run on API startup** to keep "one command" setup. In production migrations would be a
  separate deployment step.
- **Authentication with ASP.NET Core Identity + bearer tokens.** Login returns an access token (1h) and a
  refresh token; the frontend's axios interceptors attach the token and refresh it transparently on a 401.
  All API controllers require auth by default; only `/api/auth/*` is public, and it's rate limited
  (10 requests/minute per IP) on top of Identity's account lockout. No roles yet: every user can do everything.
- **MVP shortcuts in auth (on purpose):** registration and password reset have no verification step
  (no MFA, email or SMS code) - any user can be created and any user's password can be reset. The UI warns
  about it. Next step would be a one-time code before reset, using Identity's reset tokens.
- **Same origin for frontend and API** (nginx proxy in Docker, Angular proxy in dev): no CORS config and
  no per-environment API URLs in the frontend build.
