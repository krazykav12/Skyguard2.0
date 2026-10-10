import { test as base, expect } from '@playwright/test';
import type { EnvironmentReport, SatelliteContext, StationObservation, WeatherObservation } from '@workspace/api-client-react';

// Synthetic browser-test fixtures ONLY. Never import these into src or the API.
// Names explicitly identify fixtures; coordinates represent actual NYC/LA places.
export const summer = '2026-07-15T18:30:00.000Z';
export const winter = '2026-01-15T18:30:00.000Z';
export const stationA: StationObservation = {
  id: 'test-manhattan-pm25', stationId: 'test-manhattan',
  stationName: 'TEST ONLY Manhattan station', latitude: 40.7306, longitude: -73.9866,
  elevationMeters: 12, pollutant: 'PM2.5', value: 8.5, unit: 'µg/m³',
  source: 'AirNow test response', agency: 'TEST ONLY agency A', observedAt: summer,
  distanceKm: 2.6, preliminary: true, quality: 'current',
};
export const stationB: StationObservation = {
  ...stationA, id: 'test-brooklyn-pm25', stationId: 'test-brooklyn',
  stationName: 'TEST ONLY Brooklyn station', latitude: 40.6782, longitude: -73.9442,
  elevationMeters: 9, value: 17.25, agency: 'TEST ONLY agency B',
  observedAt: winter, distanceKm: 6.5, quality: 'outdated',
};
export const report: EnvironmentReport = {
  latitude: 40.7128, longitude: -74.006, radiusKm: 25, fetchedAt: summer,
  observations: [stationA, stationB, { ...stationA, id: 'test-manhattan-o3', pollutant: 'O3', value: 31, unit: 'ppb' }],
  weather: null, satellite: null,
  providers: [{
    id: 'airnow', name: 'AirNow test response', status: 'ok',
    message: 'Browser regression fixture, not live data', sourceUrl: 'https://www.airnow.gov/',
    refreshedAt: summer, nextRefreshAt: null,
  }],
};
export const emptyReport: EnvironmentReport = { ...report, observations: [] };
// Same center, different radius and station set: a center-only cache key must
// not pass these tests by serving the 25 km report with a different label.
export const radiusStation: StationObservation = {
  ...stationA, id: 'test-small-radius-pm25', stationId: 'test-small-radius',
  stationName: 'TEST ONLY small-radius station', value: 4.25,
};
export const smallRadiusReport: EnvironmentReport = {
  ...report, radiusKm: 5, observations: [radiusStation],
  fetchedAt: '2026-07-15T18:45:00.000Z',
};
export const missingMeasurementsWeather: WeatherObservation = {
  stationId: 'TEST-KNYC', stationName: 'TEST ONLY Central Park weather station',
  latitude: 40.7789, longitude: -73.9692, observedAt: summer,
  windSpeedMps: null, windDirectionDegrees: null, windGustMps: null,
  temperatureC: null, humidityPercent: null,
  description: 'TEST ONLY observation with unreported measurements',
  sourceUrl: 'https://api.weather.gov/stations/KNYC/observations/latest',
  quality: 'current',
};
export const missingMeasurementsReport: EnvironmentReport = {
  ...report, weather: missingMeasurementsWeather,
  providers: [...report.providers, {
    id: 'nws', name: 'NWS test response', status: 'ok',
    message: 'TEST ONLY station observation with missing measurements',
    sourceUrl: 'https://www.weather.gov/', refreshedAt: summer, nextRefreshAt: null,
  }],
};
export const satellite: SatelliteContext = {
  // Real-shaped GIBS request, uniquely marked and intercepted only by its test.
  imageUrl: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?service=WMS&request=GetMap&version=1.1.1&srs=EPSG%3A4326&layers=MODIS_Terra_CorrectedReflectance_TrueColor&styles=&format=image%2Fjpeg&width=512&height=512&bbox=-74.3%2C40.5%2C-73.7%2C40.9&time=2026-07-13&TEST_ONLY=image-failure',
  date: '2026-07-13',
  sourceUrl: 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api',
  description: 'TEST ONLY NASA true-color context; not a ground-level pollutant measurement.',
};
export const satelliteReport: EnvironmentReport = {
  ...report, satellite,
};
export const refreshedSatellite: SatelliteContext = {
  ...satellite,
  imageUrl: satellite.imageUrl.replace('time=2026-07-13', 'time=2026-07-14').replace('TEST_ONLY=image-failure', 'TEST_ONLY=nyc-recovered'),
  date: '2026-07-14',
  sourceUrl: `${satellite.sourceUrl}#TEST_ONLY-nyc-recovered`,
  description: 'TEST ONLY refreshed NYC satellite context; not a pollutant measurement.',
};
export const refreshedSatelliteReport: EnvironmentReport = {
  ...satelliteReport, satellite: refreshedSatellite, fetchedAt: '2026-07-15T18:35:00.000Z',
};
export const stationLA: StationObservation = {
  ...stationA, id: 'test-los-angeles-pm25', stationId: 'test-los-angeles',
  stationName: 'TEST ONLY Los Angeles station', latitude: 34.066, longitude: -118.2267,
  value: 12.75, agency: 'TEST ONLY agency LA', distanceKm: 2.2,
};
export const laReport: EnvironmentReport = {
  ...report, latitude: 34.0522, longitude: -118.2437,
  fetchedAt: '2026-07-15T18:40:00.000Z', observations: [stationLA],
};
export const laSatellite: SatelliteContext = {
  ...satellite,
  imageUrl: satellite.imageUrl.replace('bbox=-74.3%2C40.5%2C-73.7%2C40.9', 'bbox=-118.5%2C33.8%2C-118.0%2C34.3').replace('time=2026-07-13', 'time=2026-07-15').replace('TEST_ONLY=image-failure', 'TEST_ONLY=la-recovered'),
  date: '2026-07-15',
  sourceUrl: `${satellite.sourceUrl}#TEST_ONLY-la-recovered`,
  description: 'TEST ONLY Los Angeles satellite context; not a pollutant measurement.',
};
export const laSatelliteReport: EnvironmentReport = { ...laReport, satellite: laSatellite };
export function partialReport(status: 'unavailable' | 'stale'): EnvironmentReport {
  return {
    ...report,
    providers: [...report.providers, {
      id: 'nws', name: 'NWS test response', status,
      message: `TEST ONLY weather provider ${status}`,
      sourceUrl: 'https://www.weather.gov/', refreshedAt: null, nextRefreshAt: null,
    }],
  };
}
export const recoveredReport: EnvironmentReport = {
  ...report, fetchedAt: '2026-07-15T18:35:00.000Z',
  observations: [{ ...stationA, value: 9.75, observedAt: '2026-07-15T18:35:00.000Z' }],
};
type EnvironmentResponse =
  | { status?: 200; report: EnvironmentReport }
  | { status: 429 | 503; message: string };
type Location = Pick<EnvironmentReport, 'latitude' | 'longitude' | 'radiusKm'>;
const locationKey = (location: Location) => `${location.latitude},${location.longitude},${location.radiusKm}`;
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
type DelayedResponse = {
  response: EnvironmentResponse;
  started: ReturnType<typeof latch>;
  released: ReturnType<typeof latch>;
  finished: ReturnType<typeof latch>;
};
type EnvironmentResponder = {
  responseFor: (location: Location) => EnvironmentResponse | undefined;
  respondWith: (response: EnvironmentResponse, location?: Location) => void;
  takeDelay: (location: Location) => DelayedResponse | undefined;
  delayNext: (location: Location, response: EnvironmentResponse) => {
    started: Promise<void>; release: () => Promise<void>;
  };
};
export const importedRecords = [
  { flight_id: 'TEST-flight-A', sensor_id: 'TEST-sensor', timestamp: '2026-07-15T14:30:00-04:00', latitude: 40.7128, longitude: -74.006, pollutant: 'PM2.5', value: 10, unit: 'µg/m³', altitude_m: 30, altitude_reference: 'AGL' },
  { flight_id: 'TEST-flight-B', sensor_id: 'TEST-sensor', timestamp: winter, latitude: 40.7306, longitude: -73.9866, pollutant: 'PM2.5', value: 20, unit: 'µg/m³', altitude_m: null, altitude_reference: '' },
];
export const csv = [
  'flight_id,sensor_id,timestamp,latitude,longitude,pollutant,value,unit,altitude_m,altitude_reference',
  'TEST-flight-A,TEST-sensor,2026-07-15T14:30:00-04:00,40.7128,-74.006,PM2.5,10,µg/m³,30,AGL',
  `TEST-flight-B,TEST-sensor,${winter},40.7306,-73.9866,PM2.5,20,µg/m³,,`,
].join('\n');

// Multiple records/sensors per flight catch partial deletion and stale filters.
// These bytes are supplied only to browser-local file choosers, never the API.
export const lifecycleRecords = [
  { ...importedRecords[0], sensor_id: 'TEST-sensor-A' },
  { ...importedRecords[0], sensor_id: 'TEST-sensor-A2', timestamp: '2026-07-15T18:31:00Z', value: 14 },
  { ...importedRecords[1], sensor_id: 'TEST-sensor-B' },
  { ...importedRecords[1], sensor_id: 'TEST-sensor-B2', timestamp: '2026-01-15T18:31:00Z', value: 24 },
  { ...importedRecords[1], flight_id: 'TEST-flight-C', sensor_id: 'TEST-sensor-C', timestamp: '2026-01-15T18:32:00Z', value: 30 },
];
export const lifecycleCsv = [
  csv.split('\n')[0],
  ...lifecycleRecords.map(r => [r.flight_id, r.sensor_id, r.timestamp, r.latitude, r.longitude, r.pollutant, r.value, r.unit, r.altitude_m, r.altitude_reference].join(',')),
].join('\n');

export const test = base.extend<{
  environmentRequests: URL[];
  environmentResponder: EnvironmentResponder;
  satelliteImageRequests: string[];
}>({
  satelliteImageRequests: async ({ page }, use) => {
    const requests: string[] = [];
    // Exact, TEST_ONLY URLs only: never contact NASA or ship image fixtures.
    for (const image of [satellite, refreshedSatellite, laSatellite]) {
      await page.route(image.imageUrl, async route => {
        requests.push(route.request().url());
        if (image === satellite) await route.abort('failed');
        else await route.fulfill({
          contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64'),
        });
      });
    }
    await use(requests);
  },
  environmentResponder: async ({}, use) => {
    const responses = new Map<string, EnvironmentResponse>([
      [locationKey(report), { report }],
      [locationKey(laReport), { report: laReport }],
      [locationKey(smallRadiusReport), { report: smallRadiusReport }],
      [locationKey({ ...report, radiusKm: 35 }), { report: { ...report, radiusKm: 35 } }],
      [locationKey({ ...laReport, radiusKm: 35 }), { report: { ...laReport, radiusKm: 35 } }],
    ]);
    const delays = new Map<string, DelayedResponse>();
    const pending: DelayedResponse[] = [];
    try {
      await use({
        responseFor: location => responses.get(locationKey(location)),
        respondWith: (response, location = report) => { responses.set(locationKey(location), response); },
        takeDelay: location => {
          const key = locationKey(location);
          const delay = delays.get(key);
          delays.delete(key);
          return delay;
        },
        delayNext: (location, response) => {
          const key = locationKey(location);
          if (delays.has(key)) throw new Error(`Response already delayed for ${key}`);
          const delay = { response, started: latch(), released: latch(), finished: latch() };
          delays.set(key, delay);
          pending.push(delay);
          return {
            started: delay.started.promise,
            release: async () => { delay.released.resolve(); await delay.finished.promise; },
          };
        },
      });
    } finally {
      // An assertion failure must not leave an intercepted request blocked.
      for (const delay of pending) delay.released.resolve();
    }
  },
  environmentRequests: async ({ page, environmentResponder }, use) => {
    const requests: URL[] = [];
    // Test-local state stays in the browser interceptor. Failures persist across
    // automatic retries until the test explicitly changes the response.
    await page.route('**/api/environment**', async route => {
      const url = new URL(route.request().url());
      requests.push(url);
      const latitude = Number(url.searchParams.get('latitude'));
      const longitude = Number(url.searchParams.get('longitude'));
      const radiusKm = Number(url.searchParams.get('radiusKm'));
      // Fixtures intentionally support only the selected NYC/LA areas: a wrong
      // location must fail, not silently receive unrelated observations.
      const location = { latitude, longitude, radiusKm };
      const current = environmentResponder.responseFor(location);
      if (!current) {
        await route.fulfill({ status: 400, json: { message: 'No test fixture for this location and radius' } });
        return;
      }
      // Capture the response at request start, not when a delay is released.
      const delayed = environmentResponder.takeDelay(location);
      const response = delayed?.response ?? current;
      delayed?.started.resolve();
      if (delayed) await delayed.released.promise;
      try {
        if ('message' in response) {
          await route.fulfill({ status: response.status, json: { message: response.message } });
        } else {
          await route.fulfill({ json: response.report });
        }
      } finally {
        delayed?.finished.resolve();
      }
    });
    // Keep provider/tile availability out of deterministic browser checks.
    await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64'),
    }));
    await page.route('**/api/analytics**', route => route.fulfill({ status: 204 }));
    await use(requests);
  },
});
export { expect };
