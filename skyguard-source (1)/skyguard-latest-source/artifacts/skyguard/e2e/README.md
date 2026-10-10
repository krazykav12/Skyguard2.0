# SkyGuard browser regressions

From the workspace root:

```sh
pnpm --filter @workspace/skyguard test:e2e
pnpm --filter @workspace/skyguard typecheck:e2e
```

The full suite runs the same scenarios in desktop Chromium, Pixel 7 mobile
Chromium, desktop Firefox, desktop WebKit and iPhone 13 WebKit. It starts and stops
an isolated Vite frontend on port 5199.
No backend, database, secrets or provider access is required. The managed preview
is not stopped or replaced.

## Browser setup

Use a supported Ubuntu 24.04 runner (or a supported macOS host) for the full
matrix. Install the engines matching the lockfile's Playwright version after
installing workspace dependencies:

```sh
pnpm install --frozen-lockfile
# Ubuntu: also installs system libraries; requires permission to install OS packages.
pnpm --filter @workspace/skyguard exec playwright install --with-deps chromium firefox webkit
pnpm --filter @workspace/skyguard typecheck:e2e
pnpm --filter @workspace/skyguard test:e2e
```

On macOS, use `playwright install chromium firefox webkit` without `--with-deps`.
WebKit tests the actual browser engine used by Safari, not a Chrome user-agent
override. It is Playwright's WebKit build, not the installed, branded Safari app;
it does not certify every Safari/macOS/iOS combination. Firefox likewise uses
the actual Firefox engine, not Chromium emulation.

`.github/workflows/skyguard-browsers.yml` runs the complete matrix on Ubuntu 24.04
for pushes, pull requests and manual runs, and uploads the report and failure
evidence for 14 days. No connected GitHub repository is required for local runs;
the workflow becomes active when this project is pushed to GitHub.

Replit's Nix-managed browser environment provides Chromium but is not a supported
target for Playwright's Ubuntu `install-deps` command. The local
`skyguard-browser-regressions` workflow deliberately runs the existing Chromium
desktop/mobile checks, rather than silently skipping unavailable Firefox/WebKit
projects. The portable full-matrix command above still selects all five projects
and fails explicitly if any engine cannot launch. To run just the local checks:

```sh
pnpm --filter @workspace/skyguard test:e2e:chromium
```

Replit's preinstalled Chromium is detected automatically for Chromium projects
only. On another machine, those projects use the matching downloaded Chromium.
To use a different Chromium installation, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.
This override never applies to Firefox or WebKit. Reinstall browser binaries
after upgrading Playwright; arbitrary system Firefox/Safari binaries are not
drop-in substitutes for Playwright's instrumented builds.
To test an already-running frontend instead of starting Vite, set
`SKYGUARD_E2E_BASE_URL` to its full URL, including its preview path and a trailing
slash. This is intended for development previews, not production.

## Coverage

- No initial area, station request, station markers or imported flights.
- Explicit NYC preset, typed coordinates/radius and permitted geolocation;
  denied permission never substitutes a location.
- Request coordinates, station identity, coordinates, agency, source, value and
  unit; current/outdated station dots visible and clickable in both maps.
- Table click and keyboard selection; pollutant changes select the right reading.
- Touch-enabled Pixel 7 and iPhone projects use `Locator.tap()` (not mouse clicks)
  on all five tabs, the NYC preset, Leaflet SVG station paths in Live and Missions,
  station rows, the O3 marker and the proposal generation button. Both station
  selections must update the matching detail reading and selected table row.
- Proposal controls/results and flight comparison choices survive all five tabs.
- CSV and JSON imports stay session-local, survive tab switches and reload, retain
  missing altitude, and compare the imported values.
- Tapping the file input opens a Playwright file chooser before CSV/JSON bytes
  are supplied. After reload both imported flights and their values remain
  available in Sensors and Compare; location is not silently restored.
- Malformed JSON, a partially invalid import and header-only CSV do not erase or
  partially overwrite valid records (including a reused filename).
- CSV/JSON removal deletes every record of only the chosen flight, even with a
  sensor filter active. Unrelated records retain every stored field and table
  cell across all tabs and reload; ground-station rows are unaffected.
- Removing either selected comparison flight recovers to valid remaining
  choices and recalculates statistics. With one flight left, the second selector
  is disabled, explicitly asks for another import, and shows no difference.
- Clearing with active flight/sensor filters resets those filters, disables
  export/clear, and shows explicit empty Sensors/Compare states across tab
  switches and reload. Importing again works both before and after reload.
- UTC, automatic Eastern/Pacific and fixed EST/PST show the same observation
  instants in summer and winter across station details, imports, comparisons and
  provider timestamps. Offset-bearing imports normalize to unchanged ISO instants.
- All tabs and the shared zone selector are exercised in Firefox and WebKit as
  well as desktop and mobile Chromium.
- Empty reports show zero observations, no station markers or measurements across
  all tools, and no substituted weather or satellite context; refresh can recover.
- Unavailable and stale weather providers show partial-data and source-status
  warnings while preserving attributed station readings.
- A present weather observation with null wind speed/direction, gust, temperature
  and humidity stays explicitly unreported, without a direction arrow or numeric
  defaults, while retaining station, observation time and source attribution.
- An intercepted satellite image failure shows an explicit error and retains a
  NASA source link that opens its destination (also intercepted, without live access).
- Initial HTTP 429/503 errors show explicit unavailable states without fabricated
  readings, and Retry loads an attributed report.
- A failed refresh retains the selected station, values, source, agency and original
  observation/report times under a stale warning; Retry replaces them with the
  recovered report and clears the warning.
- Switching from NYC to LA during an initial request, during a refresh or after a
  successful report clears old station readings across all tools. Test-controlled
  delays release the obsolete response before or after LA completes; LA failures
  never reuse NYC's cached report as stale data, and Retry recovers only LA data.

## Isolation and failure diagnosis

- Radius-specific reports at the same NYC center distinguish 25 km from 5 km
  station sets. Changing radius during initial load, refresh, or after generating
  a route clears old stations across mounted tools and removes route cards,
  map waypoints, and exports. Delayed old responses cannot restore them while
  loading or after success/failure; Retry requests the new radius only. A fresh
  proposal uses the new station set and survives tab switches on desktop/touch.

`fixtures.ts` contains explicitly TEST ONLY synthetic responses at real NYC/LA
coordinates. Playwright intercepts environment requests in its browser context;
an unexpected area gets an error instead of unrelated observations. Map tiles
are replaced by a tiny local image, but Leaflet, SVG markers and mouse/touch handling
are real. Each test has fresh browser/session storage. No fixture is imported by
production code, added to public assets or served by the API. E2E files are also
excluded from deployment uploads.
The test-local `environmentResponder` changes intercepted reports or HTTP errors
without touching the API. An error persists through automatic query retries until
the test explicitly supplies a successful response.

These checks verify UI handling of the provider contract, not live provider
accuracy or uptime. Production must continue to use only actual provider
measurements or user imports, with missing data explicitly unavailable.

Use `test:e2e:ui` for interactive diagnosis. To run a focused check:

```sh
pnpm --filter @workspace/skyguard test:e2e --project=mobile -g "station dots"
pnpm --filter @workspace/skyguard test:e2e --project=firefox
pnpm --filter @workspace/skyguard test:e2e --project=webkit
pnpm --filter @workspace/skyguard test:e2e --project=iphone-webkit
# Focused touch selection + both import formats on a supported runner:
pnpm --filter @workspace/skyguard test:e2e --project=iphone-webkit -g "station dots|imports and planning"
```

## iPhone emulation limits and real-iOS spot check

`iphone-webkit` uses Playwright's iPhone 13 descriptor: mobile viewport, screen,
device scale, user agent and touch support, with the WebKit engine explicitly
selected. It runs the entire suite, not just the focused scenarios above, in the
supported Ubuntu CI job. There is no conditional skip if WebKit cannot launch.

This is **not an iPhone or the shipped iOS Safari binary**. It does not verify the
native Files/iCloud picker, Safari permission sheets, dynamic address bar/safe
areas, software keyboard, real finger accuracy, OS memory pressure or private
browsing/storage restrictions. Select options and file contents are supplied by
automation; opening a chooser is verified, but navigating native Files is not.
Reload persistence means same-tab session storage, not permanent storage or
cross-tab sync. Fresh test contexts must still start without imported records.

Before claiming real-iOS compatibility, perform this short manual check on a
physical iPhone using Safari (not an embedded browser):

1. Record device model, iOS version, URL/build, date, normal/private mode and
   pass/fail notes. Start a fresh normal tab; no area or imported records should
   appear. Choose an actual area with available station coverage, or type its
   coordinates. If a provider is unavailable, record that separately; never seed
   measurements to make the check pass.
2. With a finger, tap two visible station dots in Live, then in Missions.
   Confirm each tap selects the corresponding name, value, unit, source and
   observation time and highlights the same table row. Scroll down/up and repeat
   after returning to each map. Confirm markers remain correctly positioned.
3. Tap Live, Missions, Sensors, Compare and Sources; the active panel must be
   reachable without horizontal page overflow or controls hidden by Safari's
   toolbar. Check the timezone selector and one native select control.
4. In Sensors, tap the file control and use the **native Files picker** to import
   a small CSV of your own known records. Check values and missing altitude in
   Sensors and Compare, visit all tabs, and reload the same tab: records must
   remain. Repeat with JSON (matching record IDs are replaced; new records are
   added). Do not use
   browser-test synthetic fixtures as real telemetry.
5. Import malformed JSON: show an error without losing the valid records, then
   reload to confirm preservation. Close that tab and open a new independent
   tab by typing the URL (not duplicating/restoring the old tab): imported records
   should be absent. Repeat reload in private mode and note any storage limits
   rather than promising durable storage there.

Automated results are in the Playwright report. The checklist is a procedure,
not a claim that a physical-iPhone check has already been performed. WebKit
results must come from a completed supported-runner job; Chromium results alone
must never be reported as a Safari pass.

HTML reports, failure screenshots and traces go under
`generated-artifacts/skyguard-e2e/`, ignored by Git and deployment uploads.
Open the report with:

```sh
pnpm --filter @workspace/skyguard exec playwright show-report ../../generated-artifacts/skyguard-e2e/report
```
