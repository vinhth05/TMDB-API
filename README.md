# TMDB Integration API

This project is deployed as a standalone TMDB integration service for the LoraFilm movie-ticket system. It acts as an integration adapter between LoraFilm and TMDB to normalize external metadata specifically for LoraFilm's requirements without acting as a raw 1:1 proxy.

## Architecture Overview
- **Runtime:** Node.js, Express
- **Process Manager:** PM2
- **Proxy:** Nginx
- **Architecture Layers:** Routes -> Middlewares (Validation, Auth, Errors) -> Controllers -> Services (caching injected) -> Utils/Mappers -> TMDB Client

## Installation

```bash
npm install
# or
npm ci
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. Do not commit `.env` to Git.

```env
NODE_ENV=development
PORT=9005

API_KEY=your-internal-api-key

TMDB_TOKEN=your-tmdb-read-access-token
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
TMDB_IMAGE_SIZE=original
TMDB_DEFAULT_LANGUAGE=vi-VN
TMDB_FALLBACK_LANGUAGE=en-US
TMDB_TIMEOUT=10000

CACHE_TTL=3600
CACHE_SEARCH_TTL=600
CACHE_MOVIE_TTL=3600
CACHE_REFERENCE_TTL=86400
```

## Development Startup

```bash
npm run dev
```

## Production Startup (PM2)

```bash
pm2 start ecosystem.config.js --env production
```

## Deployment Base URL

Production URL: `https://tmdb-api.nyanmovie.site`

## Authentication Usage

All endpoints except `/health` and Swagger docs require an API key passed in the header:

```http
x-api-key: your-internal-api-key
```

**SECURITY WARNING:** The `x-api-key` must NEVER be exposed in frontend public React/Vite bundles. Requests to this API should pass through the LoraFilm API Gateway or Movie Service.

## Swagger Documentation

Swagger UI is available at:
`http://localhost:9005/api-docs` (Development)
`https://tmdb-api.nyanmovie.site/api-docs` (Production)

## Endpoint Categories

- **Health:** `/health`
- **Search:** `/api/import/search`
- **Movie Import:** `/api/import/movies/{tmdbId}/bundle`
- **Movie Resources:** `/api/import/movies/{tmdbId}/credits`, `/videos`, `/images`, `/keywords`, `/release-dates`, `/translations`, `/alternative-titles`, `/external-ids`
- **Movie Discovery:** `/api/import/discover/movies`, `/popular`, `/upcoming`, `/trending`, etc.
- **People:** `/api/import/people/search`, `/people/{id}`
- **Reference Data:** `/api/import/genres`, `/api/import/configuration`, `/api/import/find`

## Cache Behavior

The API uses an in-memory local node-cache. The cache resets upon server restart. Keys are generated deterministically based on endpoint, TMDB ID, languages, and query filters.

## Language Fallback Behavior

The API defaults to `vi-VN`. Critical missing fields in localized responses (like overviews or primary trailers) are padded using the `en-US` fallback language without overwriting existing valid Vietnamese data. 

## Error Response Conventions

Errors are mapped securely without exposing upstream secrets. Example structure:

```json
{
  "success": false,
  "errorCode": "TMDB_RESOURCE_NOT_FOUND",
  "message": "The resource you requested could not be found.",
  "details": null,
  "timestamp": "2026-07-13T16:00:00.000Z"
}
```

For frontend integration workflows, please see [docs/FRONTEND_INTEGRATION.md](./docs/FRONTEND_INTEGRATION.md).
