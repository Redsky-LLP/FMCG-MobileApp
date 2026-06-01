FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/FMCG.Distribution.API/FMCG.Distribution.API.csproj", "src/FMCG.Distribution.API/"]
COPY ["src/FMCG.Distribution.Application/FMCG.Distribution.Application.csproj", "src/FMCG.Distribution.Application/"]
COPY ["src/FMCG.Distribution.Domain/FMCG.Distribution.Domain.csproj", "src/FMCG.Distribution.Domain/"]
COPY ["src/FMCG.Distribution.Infrastructure/FMCG.Distribution.Infrastructure.csproj", "src/FMCG.Distribution.Infrastructure/"]
COPY ["src/FMCG.Distribution.Shared/FMCG.Distribution.Shared.csproj", "src/FMCG.Distribution.Shared/"]
RUN dotnet restore "src/FMCG.Distribution.API/FMCG.Distribution.API.csproj"
COPY . .
WORKDIR "/src/src/FMCG.Distribution.API"
RUN dotnet build "FMCG.Distribution.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "FMCG.Distribution.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "FMCG.Distribution.API.dll"]
