# SkyGuard

SkyGuard is an air-quality exploration website built with React, TypeScript, Vite, and an Express API. It displays real public station measurements, supports location-based maps, proposes drone sampling coverage, and compares user-imported flight records.

## Source structure

- `artifacts/skyguard`: React frontend, styles, maps, sensor tools, source citations, and browser tests.
- `artifacts/api-server`: Express backend, AirNow parsing, NWS observations, and provider caching.
- `lib/api-spec`: OpenAPI contract.
- `lib/api-client-react`: Generated React API client.
- `lib/api-zod`: Generated validation schemas.
- `lib/db`: Database scaffolding retained as a workspace dependency; the current environmental API does not use it for imported records.
- `scripts`: Workspace utility package.

## Features and boundaries

- Optional quick-start guide: choose a location, explore a station, and generate a mission proposal. The guide can be hidden or reopened.
- The readings overview shows the selected station's value, unit, observation time, age, source, and distance to the selected area centre. Public readings, unverified imports, and mission proposals are labeled separately.
- Location is selected explicitly; there is no automatic Bay Area default.
- AirNow provides preliminary station concentrations, not calculated AQI or onboard drone readings.
- NWS supplies available weather observations.
- OpenStreetMap supplies map tiles; NASA GIBS imagery is visual context, not a pollution measurement.
- The frontend requests refreshes every five minutes. Provider observations can update less frequently.
- Mission routes are proposals, not dispatched flights. The three-minute-per-stop planning assumption is not validated aircraft performance.
- CSV/JSON flight imports are checked in the browser and remain browser-session-local.
- UTC, regional daylight-saving time zones, and fixed EST/PST displays preserve the observation instant.
- No account-login system or live aircraft-control integration is implemented.
- Contact links open the visitor's email client; the application does not send email.

## Installation and checks

Use a supported Node.js version (Node 24 recommended) and pnpm.

```sh
pnpm install
pnpm run typecheck
PORT=25808 BASE_PATH=/ pnpm run build
```

## Development

Run the backend and frontend in separate terminals:

```sh
PORT=8080 pnpm --filter @workspace/api-server run dev
```

```sh
PORT=25808 BASE_PATH=/ pnpm --filter @workspace/skyguard run dev
```

The frontend calls `/api` on the same origin. Replit's artifact router supplies that routing in the original project. When running outside Replit, add a development proxy to the `server` configuration in `artifacts/skyguard/vite.config.ts`:

```ts
proxy: {
  '/api': {
    target: 'http://127.0.0.1:8080',
    changeOrigin: true,
  },
},
```

For production outside Replit, configure an equivalent reverse proxy: serve the frontend build and route `/api` to the Express server. Do not put credentials in browser code.

Browser-test setup and commands are documented in `artifacts/skyguard/e2e/README.md`.

## Data references

The website's Data sources tab contains linked citations and provider limitations:

- [AirNow hourly data documentation](https://docs.airnowapi.org/docs/HourlyDataFactSheet.pdf)
- [AirNow monitoring locations](https://files.airnowtech.org/airnow/today/monitoring_site_locations.dat)
- [National Weather Service API](https://www.weather.gov/documentation/services-web-api)
- [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)
- [OpenStreetMap attribution](https://www.openstreetmap.org/copyright)
- [IANA time zones](https://www.iana.org/time-zones)

## Uploading this snapshot

This package is a source-only snapshot. It has no Git history, workspace conversations, agent memory, raw project uploads, dependency folders, or generated builds. The contact email addresses intentionally displayed by the website remain in its source.

Extract the archive before uploading; uploading the ZIP itself will not turn its contents into repository files.

You can clone the empty private repository with GitHub Desktop, copy the extracted files into that local repository folder, then commit and push. Preserve the directory structure. If the repository already contains work, review it before copying anything over it.

The original Replit project's Git history and backup remotes are not changed by this package.
