# Multi-stage build: the SDK image (~800MB) is only used to compile,
# the final image only carries the ASP.NET runtime and the published output.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, copying only the csproj, so Docker caches the NuGet layer
# and code-only changes don't download packages again.
COPY src/Altairis.Api/Altairis.Api.csproj src/Altairis.Api/
RUN dotnet restore src/Altairis.Api/Altairis.Api.csproj

COPY src/ src/
RUN dotnet publish src/Altairis.Api/Altairis.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Altairis.Api.dll"]
