import type { Locator, Page } from '@playwright/test';
import type { SatelliteContext } from '@workspace/api-client-react';
import { test, expect, stationA, stationB, stationLA, radiusStation, report, smallRadiusReport, laReport, emptyReport, partialReport, recoveredReport, missingMeasurementsWeather, missingMeasurementsReport, satellite, satelliteReport, refreshedSatellite, refreshedSatelliteReport, laSatellite, laSatelliteReport, importedRecords, csv, lifecycleRecords, lifecycleCsv, summer, winter } from './fixtures';

const tabs = ['live', 'missions', 'sensors', 'compare', 'sources'] as const;
// Mobile projects must exercise the browser's touch-to-click path, not merely
// run mouse clicks inside a narrow viewport. Never force or dispatch DOM clicks.
async function activate(target: Locator) {
  if (test.info().project.use.hasTouch) await target.tap();
  else await target.click();
}
async function openTab(page: Page, tab: typeof tabs[number]) {
  await activate(page.getByTestId(`tab-${tab}`));
  await expect(page.getByTestId(`tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId(`panel-${tab}`)).toBeVisible();
  for (const other of tabs.filter(t => t !== tab)) {
    await expect(page.getByTestId(`panel-${other}`)).toBeHidden();
  }
}
async function chooseNYC(page: Page) {
  await activate(page.getByTestId('button-preset-nyc'));
  await expect(page.getByTestId('panel-live').getByTestId('text-station-name')).toHaveText(stationA.stationName);
}
async function importRecords(page: Page, format: 'csv' | 'json', data = { records: importedRecords, csv }) {
  await openTab(page, 'sensors');
  // Verify the user-facing control opens a chooser on touch as well as mouse.
  // Playwright supplies bytes; the native iOS Files UI still needs a device check.
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    activate(page.getByTestId('input-telemetry-file')),
  ]);
  await chooser.setFiles({
    name: `test-records.${format}`, mimeType: format === 'json' ? 'application/json' : 'text/csv',
    buffer: Buffer.from(format === 'json' ? JSON.stringify(data.records) : data.csv),
  });
  await expect(page.getByTestId('telemetry-import-notice')).toContainText(`Imported ${data.records.length} records`);
}

// Deep equality checks every stored field, not just row count or flight names.
async function storedTelemetry(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('skyguard-telemetry-session-v1') ?? '[]') as { flightId: string }[]);
}

async function expectAttributedReading(page: Page, value: string, observed: string) {
  const detail = page.getByTestId('panel-live').getByTestId('panel-station-detail');
  await expect(detail).toContainText(stationA.stationName);
  await expect(detail).toContainText(stationA.stationId);
  await expect(detail).toContainText(stationA.agency);
  await expect(detail).toContainText(stationA.source);
  await expect(detail).toContainText('40.7306, -73.9866');
  await expect(detail.locator('.reading-value')).toHaveText(value);
  await expect(detail.locator('.reading-unit')).toHaveText(stationA.unit);
  await expect(detail.locator('.detail-item').filter({ hasText: 'Observed' }).locator('strong')).toHaveText(observed);
}

async function expectNoMeasurements(page: Page) {
  for (const tab of tabs) {
    await openTab(page, tab);
    const panel = page.getByTestId(`panel-${tab}`);
    await expect(panel.locator('[data-testid^="marker-station-"]')).toHaveCount(0);
    await expect(panel.locator('[data-testid^="row-station-"]')).toHaveCount(0);
    await expect(panel.locator('.reading-value')).toHaveCount(0);
  }
  await openTab(page, 'sensors');
  await expect(page.getByTestId('empty-imported-records')).toBeVisible();
  await openTab(page, 'compare');
  await page.getByTestId('button-compare-flights').click();
  await expect(page.getByTestId('empty-compare-flights')).toBeVisible();
  await page.getByTestId('button-compare-stations').click();
  await expect(page.getByTestId('panel-compare-stations').locator('tbody tr')).toHaveCount(0);
  await openTab(page, 'live');
}

test.beforeEach(async ({ page, environmentRequests }) => {
  // Activate the interception fixture before navigation.
  expect(environmentRequests).toEqual([]);
  await page.goto('./');
});

test('empty observations stay explicitly empty across every tool without fallback readings', async ({ page, environmentResponder, environmentRequests }) => {
  environmentResponder.respondWith({ report: emptyReport });
  await page.getByTestId('button-preset-nyc').click();
  await expect(page.getByTestId('state-no-observations')).toContainText('No station observations in this area');
  await expect(page.getByTestId('state-no-observations')).toContainText('Providers returned zero readings');
  await expect(page.getByTestId('banner-error')).toHaveCount(0);
  await expect(page.getByTestId('panel-weather')).toContainText('No weather observation');
  await expect(page.getByTestId('panel-weather')).toContainText('Nothing is substituted');
  await expect(page.getByTestId('panel-satellite')).toContainText('No imagery returned');
  await expect(page.getByTestId('text-wind-speed')).toHaveCount(0);
  await expect(page.getByTestId('img-satellite')).toHaveCount(0);
  await expectNoMeasurements(page);
  expect(environmentRequests).toHaveLength(1);
  // A later non-empty report must clear the empty state without reloading.
  environmentResponder.respondWith({ report });
  await page.getByTestId('button-refresh').click();
  await expectAttributedReading(page, '8.5', 'Jul 15, 2026, 6:30 PM UTC');
  await expect(page.getByTestId('state-no-observations')).toHaveCount(0);
});

test('null weather measurements stay unreported without numeric defaults or a wind direction', async ({ page, environmentResponder }) => {
  environmentResponder.respondWith({ report: missingMeasurementsReport });
  await chooseNYC(page);
  const weather = page.getByTestId('panel-weather');
  await weather.scrollIntoViewIfNeeded();
  await expect(weather).toBeVisible();
  await expect(weather.getByTestId('text-wind-speed')).toHaveText('n/rm/s');
  await expect(weather.locator('.reading-context')).toHaveText('from n/a; arrow shows travel direction');
  await expect(weather.locator('.reading-context')).not.toContainText(/\d|mph|deg/);
  const direction = weather.locator('svg[aria-label="Wind direction not reported"]');
  await expect(direction).toBeVisible();
  await expect(direction.locator('path')).toHaveCount(0);
  await expect(weather.locator('svg[aria-label^="Wind from"]')).toHaveCount(0);
  for (const label of ['Gust', 'Temperature', 'Humidity']) {
    await expect(weather.locator('.detail-item').filter({ hasText: label }).locator('strong')).toHaveText('Not reported');
  }
  await expect(weather).toContainText(missingMeasurementsWeather.description);
  const station = weather.locator('.detail-item').filter({ hasText: 'Station' });
  await expect(station).toContainText(missingMeasurementsWeather.stationName);
  await expect(station).toContainText(missingMeasurementsWeather.stationId);
  await expect(weather).toContainText('40.7789, -73.9692');
  await expect(weather.locator('.detail-item').filter({ hasText: 'Observed' }).locator('strong')).toHaveText('Jul 15, 2026, 6:30 PM UTC');
  await expect(weather.getByRole('link', { name: 'source' })).toHaveAttribute('href', missingMeasurementsWeather.sourceUrl);
  await expect(weather.getByRole('link', { name: 'source' })).toHaveAttribute('target', '_blank');
  await expectAttributedReading(page, '8.5', 'Jul 15, 2026, 6:30 PM UTC');
  await openTab(page, 'sources');
  const provider = page.getByTestId('provider-nws');
  await expect(provider).toContainText('NWS test response');
  await expect(provider.locator('.provider-badge')).toHaveText('OK');
  await expect(provider.getByRole('link')).toHaveAttribute('href', 'https://www.weather.gov/');
});

test('failed satellite image shows an explicit error and a working NASA source link', async ({ page, context, environmentResponder }) => {
  // Only this browser test fails this exact fixture URL; no live provider call.
  await page.route(satellite.imageUrl, route => route.abort('failed'));
  // Verify navigation without depending on NASA availability or fetching its site.
  await context.route(satellite.sourceUrl, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>TEST ONLY NASA source</title><main>TEST ONLY NASA source destination</main>',
  }));
  environmentResponder.respondWith({ report: satelliteReport });
  const imageRequest = page.waitForRequest(satellite.imageUrl);
  await chooseNYC(page);
  const imagery = page.getByTestId('panel-satellite');
  await imagery.scrollIntoViewIfNeeded(); // Trigger the lazy image on mobile too.
  await imageRequest;
  const error = imagery.getByRole('alert');
  await expect(error).toBeVisible();
  await expect(error).toContainText('Image failed to load');
  await expect(error).toContainText(satellite.description);
  await expect(imagery.getByTestId('img-satellite')).toHaveCount(0);
  await expect(imagery).not.toContainText('No imagery returned');
  const source = error.getByRole('link', { name: 'Open the NASA source' });
  await expect(source).toHaveAttribute('href', satellite.sourceUrl);
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source).toHaveAttribute('rel', 'noreferrer');
  const destinationPromise = page.waitForEvent('popup');
  await source.click();
  const destination = await destinationPromise;
  await expect(destination).toHaveURL(satellite.sourceUrl);
  await expect(destination.getByRole('main')).toHaveText('TEST ONLY NASA source destination');
  await destination.close();
  await expectAttributedReading(page, '8.5', 'Jul 15, 2026, 6:30 PM UTC');
});

async function expectLoadedSatellite(page: Page, satellite: SatelliteContext) {
  const imagery = page.getByTestId('panel-satellite');
  await imagery.scrollIntoViewIfNeeded(); // Lazy loading must work on touch too.
  const image = imagery.getByTestId('img-satellite');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', satellite.imageUrl);
  await expect(image).toHaveAttribute('alt', `NASA true-color satellite view, ${satellite.date}`);
  // A visible img with the right src can still be broken. Check decoded pixels.
  await expect.poll(() => image.evaluate((element: HTMLImageElement) =>
    element.complete && element.naturalWidth > 0 && element.naturalHeight > 0,
  )).toBe(true);
  await expect(imagery.getByRole('alert')).toHaveCount(0);
  await expect(imagery.locator('.mission-note')).toContainText(satellite.date);
  await expect(imagery.locator('.mission-note')).toContainText(satellite.description);
  const source = imagery.getByRole('link', { name: 'NASA source' });
  await expect(source).toHaveAttribute('href', satellite.sourceUrl);
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source).toHaveAttribute('rel', 'noreferrer');
}

for (const recovery of ['refresh', 'area change'] as const) {
  test(`failed satellite image recovers with a new URL after ${recovery}`, async ({ page, environmentResponder, environmentRequests, satelliteImageRequests }) => {
    expect(satelliteImageRequests).toEqual([]);
    environmentResponder.respondWith({ report: satelliteReport });
    await chooseNYC(page);
    const imagery = page.getByTestId('panel-satellite');
    await imagery.scrollIntoViewIfNeeded();
    await expect(imagery.getByRole('alert')).toContainText('Image failed to load');
    await expect(imagery.getByRole('alert')).toContainText(satellite.description);
    await expect(imagery.getByTestId('img-satellite')).toHaveCount(0);

    const nextReport = recovery === 'refresh' ? refreshedSatelliteReport : laSatelliteReport;
    const nextSatellite = recovery === 'refresh' ? refreshedSatellite : laSatellite;
    environmentResponder.respondWith({ report: nextReport }, nextReport);
    const pending = environmentResponder.delayNext(nextReport, { report: nextReport });
    await activate(page.getByTestId(recovery === 'refresh' ? 'button-refresh' : 'button-preset-la'));
    await pending.started;
    if (recovery === 'area change') {
      await expectLAArea(page);
      await expect(page.getByTestId('state-loading')).toBeVisible();
      await expect(imagery).toHaveCount(0);
      await expect(page.getByTestId('img-satellite')).toHaveCount(0);
      await expect(page.getByTestId('panel-live')).not.toContainText(satellite.description);
      await expect(page.getByTestId('panel-live').locator(`a[href="${satellite.sourceUrl}"]`)).toHaveCount(0);
    }
    await pending.release();
    await expectLoadedSatellite(page, nextSatellite);
    await expect(imagery).not.toContainText(satellite.description);
    await expect(imagery).not.toContainText(satellite.date);
    await expect(imagery.locator(`a[href="${satellite.sourceUrl}"]`)).toHaveCount(0);
    expect(satelliteImageRequests).toEqual([satellite.imageUrl, nextSatellite.imageUrl]);
    expect(environmentRequests.map(url => Object.fromEntries(url.searchParams))).toEqual([
      { latitude: String(report.latitude), longitude: String(report.longitude), radiusKm: '25' },
      { latitude: String(nextReport.latitude), longitude: String(nextReport.longitude), radiusKm: '25' },
    ]);
  });
}

test('changing area removes loaded satellite imagery while loading and when the new report has none', async ({ page, environmentResponder, satelliteImageRequests }) => {
  environmentResponder.respondWith({ report: refreshedSatelliteReport });
  await chooseNYC(page);
  await expectLoadedSatellite(page, refreshedSatellite);
  const pending = environmentResponder.delayNext(laReport, { report: laReport });
  await activate(page.getByTestId('button-preset-la'));
  await pending.started;
  const expectNoOldImagery = async () => {
    await expect(page.getByTestId('img-satellite')).toHaveCount(0);
    await expect(page.getByTestId('panel-live')).not.toContainText(refreshedSatellite.date);
    await expect(page.getByTestId('panel-live')).not.toContainText(refreshedSatellite.description);
    await expect(page.getByTestId('panel-live').locator(`a[href="${refreshedSatellite.sourceUrl}"]`)).toHaveCount(0);
  };
  await expect(page.getByTestId('state-loading')).toBeVisible();
  await expectNoOldImagery();
  await pending.release();
  await expect(page.getByTestId('panel-live').getByTestId('text-station-name')).toHaveText(stationLA.stationName);
  await expect(page.getByTestId('panel-satellite')).toContainText('No imagery returned');
  await expect(page.getByTestId('panel-satellite').getByRole('alert')).toHaveCount(0);
  await expectNoOldImagery();
  expect(satelliteImageRequests).toEqual([refreshedSatellite.imageUrl]);
});

for (const status of ['unavailable', 'stale'] as const) {
  test(`partial ${status} provider keeps attributed station readings without fabricated weather`, async ({ page, environmentResponder }) => {
    environmentResponder.respondWith({ report: partialReport(status) });
    await chooseNYC(page);
    await expect(page.getByTestId('banner-partial')).toContainText('Partial data');
    await expect(page.getByTestId('banner-partial')).toContainText(`NWS test response: ${status}`);
    await expect(page.getByTestId('banner-error')).toHaveCount(0);
    await expectAttributedReading(page, '8.5', 'Jul 15, 2026, 6:30 PM UTC');
    await expect(page.getByTestId('panel-live').locator('[data-testid^="marker-station-"]')).toHaveCount(2);
    await expect(page.getByTestId('panel-weather')).toContainText('Weather unavailable');
    await expect(page.getByTestId('panel-weather')).toContainText('Nothing is substituted');
    await expect(page.getByTestId('panel-weather').locator('.reading-value')).toHaveCount(0);
    await expect(page.getByTestId('text-wind-speed')).toHaveCount(0);
    await expect(page.getByTestId('panel-satellite')).toContainText('No imagery returned');
    await expect(page.getByTestId('img-satellite')).toHaveCount(0);
    await openTab(page, 'sources');
    const provider = page.getByTestId('provider-nws');
    await expect(provider.locator('.provider-badge')).toHaveText(status === 'stale' ? 'Stale' : 'Unavailable');
    await expect(provider).toContainText(`TEST ONLY weather provider ${status}`);
    await expect(provider.getByRole('link')).toHaveAttribute('href', 'https://www.weather.gov/');
    await expect(page.getByTestId('provider-airnow').locator('.provider-badge')).toHaveText('OK');
  });
}

for (const status of [429, 503] as const) {
  test(`initial HTTP ${status} shows unavailable measurements and Retry recovers`, async ({ page, environmentResponder, environmentRequests }) => {
    environmentResponder.respondWith({ status, message: `TEST ONLY initial HTTP ${status}` });
    await page.getByTestId('button-preset-nyc').click();
    await expect(page.getByTestId('banner-error')).toContainText('The environment report could not be loaded.');
    await expect(page.getByTestId('banner-error')).toHaveAttribute('role', 'alert');
    await expect(page.getByTestId('banner-error')).toContainText(`TEST ONLY initial HTTP ${status}`);
    await expect(page.getByTestId('state-unavailable')).toContainText('Nothing is shown in place of real measurements');
    await expect(page.getByTestId('text-fetched')).toHaveCount(0);
    await expect(page.getByTestId('state-no-observations')).toHaveCount(0);
    await expectNoMeasurements(page);
    const beforeRetry = environmentRequests.length;
    environmentResponder.respondWith({ report });
    await page.getByTestId('button-retry').click();
    await expectAttributedReading(page, '8.5', 'Jul 15, 2026, 6:30 PM UTC');
    await expect(page.getByTestId('banner-error')).toHaveCount(0);
    await expect(page.getByTestId('state-unavailable')).toHaveCount(0);
    await expect(page.getByTestId('text-fetched')).not.toContainText('STALE');
    expect(environmentRequests.length).toBeGreaterThan(beforeRetry);
  });
}

test('failed refresh retains the selected attributed report as stale until Retry succeeds', async ({ page, environmentResponder, environmentRequests }) => {
  await chooseNYC(page);
  await page.getByTestId('panel-live').getByTestId(`row-station-${stationB.id}`).click();
  const detail = page.getByTestId('panel-live').getByTestId('panel-station-detail');
  const beforeDetail = await detail.innerText();
  const beforeFetched = await page.getByTestId('text-fetched').innerText();
  environmentResponder.respondWith({ status: 503, message: 'TEST ONLY refresh service unavailable' });
  await page.getByTestId('button-refresh').click();
  await expect(page.getByTestId('banner-error')).toContainText('Refresh failed. Showing stale readings from the last successful report.');
  await expect(page.getByTestId('banner-error')).toContainText('TEST ONLY refresh service unavailable');
  await expect(page.getByTestId('text-fetched')).toHaveText(`STALE · ${beforeFetched}`);
  await expect(detail).toHaveText(beforeDetail, { useInnerText: true });
  await expect(detail.locator('.reading-value')).toHaveText('17.25');
  await expect(detail).toContainText(stationB.source);
  await expect(detail).toContainText(stationB.agency);
  await expect(detail).toContainText('Jan 15, 2026, 6:30 PM UTC');
  await expect(page.getByTestId('panel-live').locator('[data-testid^="marker-station-"]')).toHaveCount(2);
  await expect(page.getByTestId('state-unavailable')).toHaveCount(0);
  await expect(page.getByTestId('state-no-observations')).toHaveCount(0);
  await openTab(page, 'missions');
  await expect(page.getByTestId('banner-error')).toBeVisible();
  await expect(page.getByTestId('panel-missions').getByTestId('text-station-name')).toHaveText(stationB.stationName);
  await openTab(page, 'live');
  const beforeRetry = environmentRequests.length;
  environmentResponder.respondWith({ report: recoveredReport });
  await page.getByTestId('button-retry').click();
  await expectAttributedReading(page, '9.75', 'Jul 15, 2026, 6:35 PM UTC');
  await expect(page.getByTestId('banner-error')).toHaveCount(0);
  await expect(page.getByTestId('text-fetched')).not.toContainText('STALE');
  await expect(page.getByTestId('text-fetched')).toContainText('Jul 15, 2026, 6:35 PM UTC');
  await expect(page.getByTestId('panel-live').locator('[data-testid^="marker-station-"]')).toHaveCount(1);
  expect(environmentRequests.length).toBeGreaterThan(beforeRetry);
});

async function expectLAArea(page: Page) {
  await expect(page.getByTestId('button-preset-la')).toHaveClass(/is-on/);
  await expect(page.getByTestId('button-preset-nyc')).not.toHaveClass(/is-on/);
  await expect(page.getByTestId('input-latitude')).toHaveValue(String(laReport.latitude));
  await expect(page.getByTestId('input-longitude')).toHaveValue(String(laReport.longitude));
  await expect(page.locator('.eyebrow')).toContainText('Los Angeles');
}

async function expectNoNYCStations(page: Page) {
  // forceMounted panels must not keep old readings even while hidden.
  for (const station of [stationA, stationB]) {
    await expect(page.getByTestId(`marker-station-${station.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`row-station-${station.id}`)).toHaveCount(0);
  }
  await expect(page.getByTestId('text-station-name').filter({ hasText: /TEST ONLY (Manhattan|Brooklyn) station/ })).toHaveCount(0);
  for (const tab of tabs) {
    await expect(page.getByTestId(`panel-${tab}`)).not.toContainText(stationA.stationId);
    await expect(page.getByTestId(`panel-${tab}`)).not.toContainText(stationB.stationId);
  }
}

async function expectLAReport(page: Page) {
  await expectLAArea(page);
  await expectNoNYCStations(page);
  await expect(page.getByTestId('text-fetched')).toContainText('Jul 15, 2026, 6:40 PM UTC');
  await expect(page.getByTestId('banner-error')).toHaveCount(0);
  for (const tab of ['live', 'missions'] as const) {
    await openTab(page, tab);
    const panel = page.getByTestId(`panel-${tab}`);
    await expect(panel.locator('[data-testid^="marker-station-"]')).toHaveCount(1);
    const detail = panel.getByTestId('panel-station-detail');
    await expect(detail).toContainText(stationLA.stationName);
    await expect(detail).toContainText(stationLA.stationId);
    await expect(detail).toContainText(stationLA.agency);
    await expect(detail).toContainText(stationLA.source);
    await expect(detail).toContainText('34.0660, -118.2267');
    await expect(detail.locator('.reading-value')).toHaveText('12.75');
    await expect(detail.locator('.reading-unit')).toHaveText(stationLA.unit);
  }
  await openTab(page, 'sensors');
  await expect(page.getByTestId('panel-sensors')).toContainText(stationLA.stationName);
  await openTab(page, 'compare');
  await page.getByTestId('button-compare-stations').click();
  await expect(page.getByTestId('panel-compare-stations')).toContainText(stationLA.stationName);
  await openTab(page, 'live');
}

for (const phase of ['initial request', 'refresh request', 'successful report'] as const) {
  for (const outcome of ['success', 'failure'] as const) {
    test(`changing area after NYC ${phase} isolates LA ${outcome} from old readings`, async ({ page, environmentResponder, environmentRequests }) => {
      if (phase !== 'initial request') {
        await chooseNYC(page);
        await page.getByTestId('panel-live').getByTestId(`row-station-${stationB.id}`).click();
      }
      const oldRequest = phase === 'successful report' ? null : environmentResponder.delayNext(report, { report });
      if (oldRequest) {
        await page.getByTestId(phase === 'initial request' ? 'button-preset-nyc' : 'button-refresh').click();
        await oldRequest.started;
      }
      const response = outcome === 'success'
        ? { report: laReport }
        : { status: 503 as const, message: 'TEST ONLY LA service unavailable' };
      // Persist the failure for React Query's automatic retry too.
      environmentResponder.respondWith(response, laReport);
      const newRequest = environmentResponder.delayNext(laReport, response);
      await page.getByTestId('button-preset-la').click();
      await newRequest.started;
      await expectLAArea(page);
      await expect(page.getByTestId('state-loading')).toBeVisible();
      await expectNoNYCStations(page);
      await expect(page.getByTestId('text-fetched')).toHaveCount(0);
      await expect(page.getByTestId('banner-error')).toHaveCount(0);
      await newRequest.release();

      const expectNewArea = async () => {
        if (outcome === 'success') {
          await expectLAReport(page);
        } else {
          await expect(page.getByTestId('banner-error')).toContainText('The environment report could not be loaded.');
          await expect(page.getByTestId('banner-error')).toContainText('TEST ONLY LA service unavailable');
          await expect(page.getByTestId('banner-error')).not.toContainText('Showing stale readings');
          await expect(page.getByTestId('state-unavailable')).toBeVisible();
          await expect(page.getByTestId('text-fetched')).toHaveCount(0);
          await expectNoMeasurements(page);
          await expectLAArea(page);
          await expectNoNYCStations(page);
        }
      };
      await expectNewArea();
      if (oldRequest) {
        // The obsolete NYC response completes only AFTER LA succeeds or fails.
        await oldRequest.release();
        await expectNewArea();
      }
      expect(environmentRequests.map(url => Object.fromEntries(url.searchParams))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ latitude: String(report.latitude), longitude: String(report.longitude), radiusKm: '25' }),
          expect.objectContaining({ latitude: String(laReport.latitude), longitude: String(laReport.longitude), radiusKm: '25' }),
        ]),
      );
      if (outcome === 'failure') {
        environmentResponder.respondWith({ report: laReport }, laReport);
        await page.getByTestId('button-retry').click();
        await expectLAReport(page);
      }
    });
  }
}

test('changing area ignores NYC completion while LA is still loading', async ({ page, environmentResponder }) => {
  const oldRequest = environmentResponder.delayNext(report, { report });
  await page.getByTestId('button-preset-nyc').click();
  await oldRequest.started;
  const newRequest = environmentResponder.delayNext(laReport, { report: laReport });
  await page.getByTestId('button-preset-la').click();
  await newRequest.started;
  await oldRequest.release();
  await expectLAArea(page);
  await expect(page.getByTestId('state-loading')).toBeVisible();
  await expectNoNYCStations(page);
  await expect(page.getByTestId('text-fetched')).toHaveCount(0);
  await newRequest.release();
  await expectLAReport(page);
});

async function applySmallRadius(page: Page) {
  await page.getByTestId('input-radius').fill('5');
  await activate(page.getByTestId('button-apply-area'));
  await expect(page.getByTestId('input-latitude')).toHaveValue(String(report.latitude));
  await expect(page.getByTestId('input-longitude')).toHaveValue(String(report.longitude));
  await expect(page.getByTestId('input-radius')).toHaveValue('5');
  await expect(page.getByTestId('button-preset-nyc')).toHaveClass(/is-on/);
}

async function expectNoProposedRoute(page: Page) {
  // Both maps are force-mounted; hiding the old route is not enough.
  for (const map of ['map-stations', 'map-missions']) {
    await expect(page.getByTestId(map).locator('.wp-icon')).toHaveCount(0);
  }
  await expect(page.locator('[data-testid^="card-coverage-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="card-focus-"]')).toHaveCount(0);
  await expect(page.getByTestId('button-export-json')).toHaveCount(0);
  await expect(page.getByTestId('button-export-csv')).toHaveCount(0);
}

async function expectSmallRadiusReport(page: Page) {
  await expectNoNYCStations(page);
  await expectNoProposedRoute(page);
  await expect(page.getByTestId('banner-error')).toHaveCount(0);
  await expect(page.getByTestId('text-fetched')).toContainText('Jul 15, 2026, 6:45 PM UTC');
  await expect(page.getByTestId('panel-live')).toContainText('1 station within 5 km');
  for (const tab of ['live', 'missions'] as const) {
    await openTab(page, tab);
    const panel = page.getByTestId(`panel-${tab}`);
    await expect(panel.locator('[data-testid^="marker-station-"]')).toHaveCount(1);
    const detail = panel.getByTestId('panel-station-detail');
    await expect(detail).toContainText(radiusStation.stationName);
    await expect(detail).toContainText(radiusStation.stationId);
    await expect(detail.locator('.reading-value')).toHaveText('4.25');
  }
  await openTab(page, 'sensors');
  await expect(page.getByTestId('panel-sensors')).toContainText(radiusStation.stationName);
  await openTab(page, 'compare');
  await activate(page.getByTestId('button-compare-stations'));
  await expect(page.getByTestId('select-station-a')).toHaveValue(radiusStation.id);
  await expect(page.getByTestId('select-station-a').locator('option')).toHaveCount(1);
  await expect(page.getByTestId('select-station-b')).toBeDisabled();
  await expect(page.getByTestId('panel-compare-stations')).toContainText(radiusStation.stationName);
  await openTab(page, 'missions');
  await expect(page.getByTestId('panel-planner')).toContainText('No plan yet');
  await expect(page.getByTestId('button-generate-plan')).toBeEnabled();
}

async function generateRadiusPlan(page: Page) {
  await openTab(page, 'missions');
  await activate(page.getByTestId('button-generate-plan'));
  await expect(page.getByTestId('card-coverage-1')).toBeVisible();
  await expect(page.getByTestId('map-missions').locator('.wp-icon').first()).toBeVisible();
  await expect(page.getByTestId('button-export-json')).toBeEnabled();
}

test.describe('radius changes at the same center', () => {
  // Traverses every mounted tool and scrolls via real touch on mobile.
  test.slow();
  for (const phase of ['initial request', 'refresh request', 'successful report'] as const) {
    for (const outcome of ['success', 'failure'] as const) {
      test(`changing radius after ${phase} isolates new ${outcome} and clears the old route`, async ({ page, environmentResponder, environmentRequests }) => {
        if (phase !== 'initial request') {
          await chooseNYC(page);
          await generateRadiusPlan(page);
          await activate(page.getByTestId('panel-missions').getByTestId(`row-station-${stationB.id}`));
          await expect(page.getByTestId('panel-missions').getByTestId('text-station-name')).toHaveText(stationB.stationName);
        }
        const oldRequest = phase === 'successful report' ? null : environmentResponder.delayNext(report, { report });
        if (oldRequest) {
          await activate(page.getByTestId(phase === 'initial request' ? 'button-preset-nyc' : 'button-refresh'));
          await oldRequest.started;
        }
        const response = outcome === 'success'
          ? { report: smallRadiusReport }
          : { status: 503 as const, message: 'TEST ONLY small-radius service unavailable' };
        environmentResponder.respondWith(response, smallRadiusReport);
        const newRequest = environmentResponder.delayNext(smallRadiusReport, response);
        await applySmallRadius(page);
        await newRequest.started;
        await openTab(page, 'live');
        await expect(page.getByTestId('state-loading')).toBeVisible();
        await expectNoNYCStations(page);
        await expectNoProposedRoute(page);
        await expect(page.getByTestId('text-fetched')).toHaveCount(0);
        await expect(page.getByTestId('button-generate-plan')).toHaveCount(0);
        await newRequest.release();

        const expectNewRadius = async () => {
          if (outcome === 'success') {
            await expectSmallRadiusReport(page);
          } else {
            await expect(page.getByTestId('banner-error')).toContainText('The environment report could not be loaded.');
            await expect(page.getByTestId('banner-error')).toContainText('TEST ONLY small-radius service unavailable');
            await expect(page.getByTestId('banner-error')).not.toContainText('Showing stale readings');
            await expect(page.getByTestId('text-fetched')).toHaveCount(0);
            await expectNoNYCStations(page);
            await expectNoProposedRoute(page);
            await expectNoMeasurements(page);
            await expect(page.getByTestId('state-unavailable')).toBeVisible();
            await expect(page.getByTestId('button-generate-plan')).toHaveCount(0);
          }
        };
        await expectNewRadius();
        if (oldRequest) {
          // Complete the obsolete 25 km response AFTER the 5 km result.
          await oldRequest.release();
          await expectNewRadius();
        }
        if (outcome === 'failure') {
          const beforeRetry = environmentRequests.length;
          environmentResponder.respondWith({ report: smallRadiusReport }, smallRadiusReport);
          await activate(page.getByTestId('button-retry'));
          await expectSmallRadiusReport(page);
          expect(environmentRequests.slice(beforeRetry).map(url => Object.fromEntries(url.searchParams))).toEqual([
            { latitude: String(report.latitude), longitude: String(report.longitude), radiusKm: '5' },
          ]);
        }
        expect(environmentRequests.map(url => Object.fromEntries(url.searchParams))).toEqual(
          expect.arrayContaining([
            { latitude: String(report.latitude), longitude: String(report.longitude), radiusKm: '25' },
            { latitude: String(report.latitude), longitude: String(report.longitude), radiusKm: '5' },
          ]),
        );
        await generateRadiusPlan(page);
        await expect(page.getByTestId('panel-planner')).toContainText(radiusStation.stationName);
        await expect(page.getByTestId('panel-planner')).not.toContainText(stationB.stationName);
        for (const tab of tabs) await openTab(page, tab);
        await openTab(page, 'missions');
        await expect(page.getByTestId('card-coverage-1')).toBeVisible();
        await expect(page.getByTestId('button-export-json')).toBeEnabled();
        await expectNoNYCStations(page);
      });
    }
  }

  test('changing radius ignores an obsolete refresh while the new radius is still loading', async ({ page, environmentResponder }) => {
    await chooseNYC(page);
    await generateRadiusPlan(page);
    const oldRequest = environmentResponder.delayNext(report, { report });
    await activate(page.getByTestId('button-refresh'));
    await oldRequest.started;
    const newRequest = environmentResponder.delayNext(smallRadiusReport, { report: smallRadiusReport });
    await applySmallRadius(page);
    await newRequest.started;
    await oldRequest.release();
    await openTab(page, 'live');
    await expect(page.getByTestId('state-loading')).toBeVisible();
    await expectNoNYCStations(page);
    await expectNoProposedRoute(page);
    await expect(page.getByTestId('text-fetched')).toHaveCount(0);
    await newRequest.release();
    await expectSmallRadiusReport(page);
  });
});

test('first load and all five tabs assume no location or records', async ({ page, environmentRequests }) => {
  await expect(page.getByTestId('state-choose-location')).toBeVisible();
  await expect(page.getByTestId('input-latitude')).toHaveValue('');
  await expect(page.getByTestId('input-longitude')).toHaveValue('');
  await expect(page.getByTestId('button-refresh')).toBeDisabled();
  for (const tab of tabs) {
    await openTab(page, tab);
    await expect(page.getByTestId(`panel-${tab}`).locator('[data-testid^="marker-station-"]')).toHaveCount(0);
    const zone = page.getByTestId('select-global-timezone');
    await expect(zone).toBeVisible();
    await zone.selectOption('America/Los_Angeles');
    await expect(zone).toHaveValue('America/Los_Angeles');
    await expect(page.locator('.intro-copy')).toContainText('America/Los_Angeles');
  }
  await openTab(page, 'sensors');
  await expect(page.getByTestId('empty-imported-records')).toBeVisible();
  await openTab(page, 'compare');
  await expect(page.getByTestId('empty-compare-flights')).toBeVisible();
  expect(environmentRequests).toHaveLength(0);
});

// Keep the browser permission result pending without timers or real permissions.
// Each page owns its callbacks; no production hooks or shared fixture state.
type DeferredLocationWindow = Window & {
  releaseTestLocation?: (outcome: 'success' | 'denied') => void;
};

async function holdLocationResult(page: Page) {
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (success, failure) => {
      (window as DeferredLocationWindow).releaseTestLocation = outcome => {
        delete (window as DeferredLocationWindow).releaseTestLocation;
        if (outcome === 'success') {
          // NYC deliberately differs from the manually selected LA area.
          success({
            coords: {
              latitude: 40.7128, longitude: -74.006, accuracy: 10,
              altitude: null, altitudeAccuracy: null, heading: null, speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(), toJSON: () => ({}),
          });
        } else {
          if (!failure) throw new Error('Expected a geolocation error callback');
          failure({
            code: 1, message: 'Test permission denied',
            PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3,
          });
        }
      };
    };
  });
}

test.describe('obsolete geolocation callbacks', () => {
  // Include navigation/setup in the larger budget on slower touch runners.
  // Individual assertion timeouts are unchanged.
  test.slow();
  for (const method of ['preset', 'coordinates'] as const) {
    for (const outcome of ['success', 'denied'] as const) {
      test(`delayed location ${outcome} cannot replace a chosen ${method} area`, async ({ page, environmentRequests }) => {
        await holdLocationResult(page);
        await activate(page.getByTestId('button-use-location'));
        await expect(page.getByTestId('button-use-location')).toBeDisabled();
        await expect(page.getByTestId('button-hero-locate')).toBeDisabled();
        expect(await page.evaluate(() => typeof (window as DeferredLocationWindow).releaseTestLocation)).toBe('function');
        expect(environmentRequests).toHaveLength(0);

        const radius = method === 'coordinates' ? '35' : '25';
        if (method === 'preset') {
          await activate(page.getByTestId('button-preset-la'));
        } else {
          await page.getByTestId('input-latitude').fill(String(laReport.latitude));
          await page.getByTestId('input-longitude').fill(String(laReport.longitude));
          await page.getByTestId('input-radius').fill(radius);
          await activate(page.getByTestId('button-apply-area'));
        }

        const expectChosenArea = async () => {
          await expectLAArea(page);
          await expect(page.getByTestId('input-radius')).toHaveValue(radius);
          await expect(page.getByTestId('button-use-location')).toBeEnabled();
          await expect(page.getByTestId('button-hero-locate')).toBeEnabled();
          await expect(page.getByTestId('text-location-error')).toHaveCount(0);
          await expect(page.getByTestId('banner-error')).toHaveCount(0);
          await expect(page.getByTestId('state-loading')).toHaveCount(0);
          const detail = page.getByTestId('panel-live').getByTestId('panel-station-detail');
          await expect(detail.getByTestId('text-station-name')).toHaveText(stationLA.stationName);
          await expect(detail).toContainText(stationLA.stationId);
          await expect(detail).toContainText(stationLA.agency);
          await expect(detail).toContainText(stationLA.source);
          await expect(detail.locator('.reading-value')).toHaveText('12.75');
          await expect(detail.locator('.reading-unit')).toHaveText(stationLA.unit);
          await expectNoNYCStations(page);
          expect(environmentRequests).toHaveLength(1);
          expect(Object.fromEntries(environmentRequests[0].searchParams)).toMatchObject({
            latitude: String(laReport.latitude), longitude: String(laReport.longitude), radiusKm: radius,
          });
        };
        // Prove the manual report has loaded before releasing the old callback.
        await expectChosenArea();
        await page.evaluate(async result => {
          const release = (window as DeferredLocationWindow).releaseTestLocation;
          if (!release) throw new Error('No pending geolocation callback');
          release(result);
          // Let React commit any callback-driven changes before negative checks.
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        }, outcome);
        await expectChosenArea();
      });
    }
  }
});

test('denied browser permission never substitutes a default location', async ({ page, environmentRequests }) => {
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_success, failure) => failure?.({
      code: 1, message: 'Test permission denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3,
    });
  });
  await page.getByTestId('button-use-location').click();
  await expect(page.getByTestId('text-location-error')).toContainText('No default location has been substituted');
  await expect(page.getByTestId('state-choose-location')).toBeVisible();
  expect(environmentRequests).toHaveLength(0);
});

for (const method of ['preset', 'coordinates', 'geolocation'] as const) {
  test(`${method} loads observations attributed to the chosen actual area`, async ({ page, context, environmentRequests }) => {
    if (method === 'preset') await chooseNYC(page);
    if (method === 'coordinates') {
      await page.getByTestId('input-latitude').fill('40.7128');
      await page.getByTestId('input-longitude').fill('-74.006');
      await page.getByTestId('input-radius').fill('35');
      await page.getByTestId('button-apply-area').click();
    }
    if (method === 'geolocation') {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 40.7128, longitude: -74.006 });
      await page.getByTestId('button-use-location').click();
    }
    const detail = page.getByTestId('panel-live').getByTestId('panel-station-detail');
    await expect(detail).toContainText(stationA.stationName);
    await expect(detail).toContainText('40.7306, -73.9866');
    await expect(detail).toContainText(stationA.agency);
    await expect(detail).toContainText(stationA.source);
    await expect(detail).toContainText(stationA.stationId);
    await expect(detail.locator('.reading-value')).toHaveText('8.5');
    await expect(detail.locator('.reading-unit')).toHaveText('µg/m³');
    expect(environmentRequests).toHaveLength(1);
    expect(Object.fromEntries(environmentRequests[0].searchParams)).toMatchObject({
      latitude: '40.7128', longitude: '-74.006', radiusKm: method === 'coordinates' ? '35' : '25',
    });
  });
}

test('visible station dots and table rows select matching details in both maps', async ({ page }) => {
  if (test.info().project.use.hasTouch) {
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
  }
  await chooseNYC(page);
  for (const tab of ['live', 'missions'] as const) {
    await openTab(page, tab);
    const panel = page.getByTestId(`panel-${tab}`);
    await expect(panel.locator('[data-testid^="marker-station-"]')).toHaveCount(2);
    for (const station of [stationB, stationA]) {
      const marker = panel.getByTestId(`marker-station-${station.id}`);
      await expect(marker).toHaveJSProperty('tagName', 'path');
      await expect(marker).toBeVisible();
      const box = await marker.boundingBox();
      expect(box?.width).toBeGreaterThan(10);
      expect(box?.height).toBeGreaterThan(10);
      await activate(marker);
      await expect(panel.getByTestId('text-station-name')).toHaveText(station.stationName);
      await expect(panel.getByTestId('panel-station-detail').locator('.reading-value')).toHaveText(String(station.value));
      await expect(panel.getByTestId(`row-station-${station.id}`)).toHaveClass(/is-selected/);
    }
    await activate(panel.getByTestId(`row-station-${stationB.id}`));
    await expect(panel.getByTestId('text-station-name')).toHaveText(stationB.stationName);
    await panel.getByTestId(`row-station-${stationA.id}`).focus();
    await page.keyboard.press('Enter');
    await expect(panel.getByTestId('text-station-name')).toHaveText(stationA.stationName);
  }
  await openTab(page, 'live');
  await page.getByTestId('select-pollutant').selectOption('O3');
  const live = page.getByTestId('panel-live');
  await expect(live.locator('[data-testid^="marker-station-"]')).toHaveCount(1);
  await activate(live.getByTestId('marker-station-test-manhattan-o3'));
  await expect(live.getByTestId('panel-station-detail').locator('.reading-value')).toHaveText('31');
  await expect(live.getByTestId('panel-station-detail').locator('.reading-unit')).toHaveText('ppb');
});

for (const format of ['csv', 'json'] as const) {
  test(`${format} imports and planning proposals survive tab switches; rejected imports preserve records`, async ({ page }) => {
    await chooseNYC(page);
    await openTab(page, 'missions');
    await page.getByTestId('select-fleet').selectOption('3');
    await page.getByTestId('input-sample-budget').fill('8');
    await activate(page.getByTestId('button-generate-plan'));
    await expect(page.getByTestId('button-export-json')).toBeEnabled();
    const plannerText = await page.getByTestId('panel-planner').innerText();
    await importRecords(page, format);
    const importedRows = page.getByTestId('panel-imported-records').locator('tbody tr');
    await expect(importedRows).toHaveCount(2);
    await expect(importedRows.filter({ hasText: 'TEST-flight-B' })).toContainText('Not supplied');
    await openTab(page, 'compare');
    await expect(page.getByTestId('select-primary-flight')).toHaveValue('TEST-flight-B');
    await expect(page.getByTestId('table-flight-stats')).toContainText('20.00');
    await expect(page.getByTestId('table-flight-stats')).toContainText('10.00');
    await page.getByTestId('select-primary-flight').selectOption('TEST-flight-A');
    await expect(page.getByTestId('text-flight-difference')).toContainText('-10.00');
    for (const tab of tabs) await openTab(page, tab);
    await openTab(page, 'missions');
    await expect(page.getByTestId('select-fleet')).toHaveValue('3');
    expect(await page.getByTestId('panel-planner').innerText()).toBe(plannerText);
    await expect(page.getByTestId('banner-planning-proposal')).toContainText('not dispatch');
    await openTab(page, 'compare');
    await expect(page.getByTestId('select-primary-flight')).toHaveValue('TEST-flight-A');
    await expect(page.getByTestId('text-flight-difference')).toContainText('-10.00');
    await openTab(page, 'sensors');
    const before = await importedRows.allTextContents();
    for (const payload of ['{broken json', JSON.stringify([importedRecords[0], { ...importedRecords[1], value: 'invalid' }]), csv.split('\n')[0]]) {
      await page.getByTestId('input-telemetry-file').setInputFiles({
        name: `test-records.${format}`, mimeType: 'application/json', buffer: Buffer.from(payload),
      });
      await expect(page.getByTestId('telemetry-import-error')).toBeVisible();
      expect(await importedRows.allTextContents()).toEqual(before);
    }
    await page.reload();
    await openTab(page, 'sensors');
    await expect(importedRows).toHaveCount(2);
    expect(await importedRows.allTextContents()).toEqual(before);
    await openTab(page, 'compare');
    await expect(page.getByTestId('table-flight-stats')).toContainText('TEST-flight-A');
    await expect(page.getByTestId('table-flight-stats')).toContainText('TEST-flight-B');
    await expect(page.getByTestId('table-flight-stats')).toContainText('20.00');
    await expect(page.getByTestId('table-flight-stats')).toContainText('10.00');
    await expect(page.getByTestId('input-latitude')).toHaveValue('');
  });
}

for (const format of ['csv', 'json'] as const) {
  for (const removedRole of ['primary', 'comparison'] as const) {
    test(`${format} removing the selected ${removedRole} flight preserves other records; clear and reimport recover`, async ({ page }) => {
      await chooseNYC(page);
      await importRecords(page, format, { records: lifecycleRecords, csv: lifecycleCsv });
      const rows = page.getByTestId('panel-imported-records').locator('tbody tr');
      await expect(rows).toHaveCount(5);
      const before = await storedTelemetry(page);
      const removed = removedRole === 'primary' ? 'TEST-flight-A' : 'TEST-flight-B';
      const survivors = before.filter(r => r.flightId !== removed);
      const survivorRows = await rows.filter({ hasNotText: removed }).allTextContents();
      const stationRows = await page.getByTestId('panel-station-channels').locator('tbody tr').allTextContents();

      await openTab(page, 'compare');
      await page.getByTestId('select-primary-flight').selectOption('TEST-flight-A');
      await page.getByTestId('select-comparison-flight').selectOption('TEST-flight-B');
      await expect(page.getByTestId('text-flight-difference')).toContainText('-10.00');
      await openTab(page, 'sensors');
      await page.getByTestId('select-sensor-flight').selectOption(removed);
      await page.getByTestId('select-sensor-id').selectOption(removedRole === 'primary' ? 'TEST-sensor-A' : 'TEST-sensor-B');
      await expect(rows).toHaveCount(1);
      await activate(page.getByTestId('button-remove-flight'));
      await expect(page.getByTestId('select-sensor-flight')).toHaveValue('all');
      await expect(page.getByTestId('select-sensor-id')).toHaveValue('all');
      await expect(rows).toHaveCount(survivors.length);
      expect(await rows.allTextContents()).toEqual(survivorRows);
      expect(await storedTelemetry(page)).toEqual(survivors);
      await expect(page.getByTestId('button-remove-flight')).toHaveCount(0);

      const expectedPrimary = removedRole === 'primary' ? 'TEST-flight-B' : 'TEST-flight-A';
      const expectedComparison = 'TEST-flight-C';
      const expectRecoveredComparison = async () => {
        await openTab(page, 'compare');
        await expect(page.getByTestId('select-primary-flight')).toHaveValue(expectedPrimary);
        await expect(page.getByTestId('select-comparison-flight')).toHaveValue(expectedComparison);
        await expect(page.getByTestId('select-comparison-flight')).toBeEnabled();
        for (const id of ['select-primary-flight', 'select-comparison-flight']) {
          await expect(page.getByTestId(id).locator('option', { hasText: removed })).toHaveCount(0);
        }
        await expect(page.getByTestId('table-flight-stats').locator('tbody tr')).toHaveCount(2);
        await expect(page.getByTestId('table-flight-stats')).not.toContainText(removed);
        await expect(page.getByTestId('text-flight-difference')).toContainText(removedRole === 'primary' ? '-8.00' : '-18.00');
      };
      await expectRecoveredComparison();
      for (const tab of tabs) await openTab(page, tab);
      await openTab(page, 'sensors');
      expect(await rows.allTextContents()).toEqual(survivorRows);
      expect(await page.getByTestId('panel-station-channels').locator('tbody tr').allTextContents()).toEqual(stationRows);
      await expectRecoveredComparison();
      await page.reload();
      await openTab(page, 'sensors');
      await expect(rows).toHaveCount(survivors.length);
      expect(await rows.allTextContents()).toEqual(survivorRows);
      expect(await storedTelemetry(page)).toEqual(survivors);
      // Comparison choices are session component state, not persisted choices.
      await openTab(page, 'compare');
      await expect(page.getByTestId('table-flight-stats')).not.toContainText(removed);
      await expect(page.getByTestId('select-primary-flight')).toHaveValue(survivors[0].flightId);
      await expect(page.getByTestId('select-comparison-flight')).toHaveValue(survivors.find(r => r.flightId !== survivors[0].flightId)!.flightId);

      // Also remove a selected comparison when only one flight will remain.
      const lastFlight = removedRole === 'primary' ? 'TEST-flight-B' : 'TEST-flight-A';
      await page.getByTestId('select-primary-flight').selectOption(lastFlight);
      await page.getByTestId('select-comparison-flight').selectOption('TEST-flight-C');
      await openTab(page, 'sensors');
      await page.getByTestId('select-sensor-flight').selectOption('TEST-flight-C');
      await activate(page.getByTestId('button-remove-flight'));
      const lastRecords = survivors.filter(r => r.flightId === lastFlight);
      await expect(rows).toHaveCount(2);
      expect(await storedTelemetry(page)).toEqual(lastRecords);
      await openTab(page, 'compare');
      await expect(page.getByTestId('select-primary-flight')).toHaveValue(lastFlight);
      await expect(page.getByTestId('select-comparison-flight')).toHaveValue('');
      await expect(page.getByTestId('select-comparison-flight')).toBeDisabled();
      await expect(page.getByTestId('select-comparison-flight')).toContainText('Import a second flight');
      await expect(page.getByTestId('text-flight-difference')).toHaveCount(0);
      await expect(page.getByTestId('table-flight-stats').locator('tbody tr')).toHaveCount(1);

      await openTab(page, 'sensors');
      await page.getByTestId('select-sensor-flight').selectOption(lastFlight);
      await page.getByTestId('select-sensor-id').selectOption(removedRole === 'primary' ? 'TEST-sensor-B' : 'TEST-sensor-A');
      await activate(page.getByTestId('button-clear-telemetry'));
      const expectEmptySession = async () => {
        await openTab(page, 'sensors');
        await expect(rows).toHaveCount(0);
        await expect(page.getByTestId('empty-imported-records')).toContainText('No drone telemetry imported');
        await expect(page.getByTestId('button-clear-telemetry')).toBeDisabled();
        await expect(page.getByTestId('button-export-telemetry')).toBeDisabled();
        await expect(page.getByTestId('telemetry-import-notice')).toHaveCount(0);
        await expect(page.getByTestId('telemetry-import-error')).toHaveCount(0);
        await expect(page.getByTestId('select-sensor-flight')).toHaveValue('all');
        await expect(page.getByTestId('select-sensor-id')).toHaveValue('all');
        await expect(page.getByTestId('button-remove-flight')).toHaveCount(0);
        expect(await storedTelemetry(page)).toEqual([]);
        await openTab(page, 'compare');
        await expect(page.getByTestId('empty-compare-flights')).toContainText('No flight records imported');
        await expect(page.getByTestId('button-compare-flights')).toContainText('(0)');
        await expect(page.getByTestId('table-flight-stats')).toHaveCount(0);
        await expect(page.getByTestId('select-primary-flight')).toHaveCount(0);
      };
      await expectEmptySession();
      for (const tab of tabs) await openTab(page, tab);
      await expectEmptySession();
      // Reimport before reload too: stale in-memory filters must not hide it.
      await importRecords(page, format);
      await expect(rows).toHaveCount(2);
      await openTab(page, 'compare');
      await expect(page.getByTestId('table-flight-stats')).toContainText('10.00');
      await expect(page.getByTestId('table-flight-stats')).toContainText('20.00');
      await openTab(page, 'sensors');
      await activate(page.getByTestId('button-clear-telemetry'));
      await page.reload();
      await expectEmptySession();
      await importRecords(page, format);
      await expect(rows).toHaveCount(2);
      await page.reload();
      await openTab(page, 'sensors');
      await expect(rows).toHaveCount(2);
      await openTab(page, 'compare');
      await expect(page.getByTestId('select-comparison-flight')).toBeEnabled();
      await expect(page.getByTestId('table-flight-stats')).toContainText('TEST-flight-A');
      await expect(page.getByTestId('table-flight-stats')).toContainText('TEST-flight-B');
    });
  }
}

test('shared zones preserve summer/winter station and imported observation instants', async ({ page }) => {
  await chooseNYC(page);
  await importRecords(page, 'json');
  // Explicit expectations independent of production fmtTime: regional DST
  // differs from fixed EST/PST in summer, but agrees in winter.
  const zones = [
    ['UTC', '6:30', 'UTC', '6:30', 'UTC', 'PM'],
    ['America/New_York', '2:30', 'EDT', '1:30', 'EST', 'PM'],
    ['America/Los_Angeles', '11:30', 'PDT', '10:30', 'PST', 'AM'],
    ['Etc/GMT+5', '1:30', 'EST', '1:30', 'EST', 'PM'],
    ['Etc/GMT+8', '10:30', 'PST', '10:30', 'PST', 'AM'],
  ];
  for (const [zone, summerClock, summerLabel, winterClock, winterLabel, period] of zones) {
    await page.getByTestId('select-global-timezone').selectOption(zone);
    for (const tab of ['live', 'missions'] as const) {
      await openTab(page, tab);
      const panel = page.getByTestId(`panel-${tab}`);
      for (const [station, clock, label, month] of [
        [stationA, summerClock, summerLabel, 'Jul'],
        [stationB, winterClock, winterLabel, 'Jan'],
      ] as const) {
        await panel.getByTestId(`row-station-${station.id}`).click();
        const observed = panel.getByTestId('panel-station-detail').locator('.detail-item').filter({ hasText: 'Observed' });
        await expect(observed.locator('strong')).toHaveText(`${month} 15, 2026, ${clock} ${period} ${label}`);
      }
    }
    await openTab(page, 'sensors');
    const rows = page.getByTestId('panel-imported-records').locator('tbody tr');
    await expect(rows.filter({ hasText: 'TEST-flight-A' }).locator('.sensor-time')).toHaveText(`Jul 15, 2026, ${summerClock}:00 ${period} ${summerLabel}`);
    await expect(rows.filter({ hasText: 'TEST-flight-B' }).locator('.sensor-time')).toHaveText(`Jan 15, 2026, ${winterClock}:00 ${period} ${winterLabel}`);
    await openTab(page, 'compare');
    await expect(page.getByTestId('panel-compare-flights').locator('.compare-desc').first()).toContainText(summerLabel);
    await expect(page.getByTestId('panel-compare-flights').locator('.compare-desc').first()).toContainText(winterLabel);
    await page.getByTestId('button-compare-stations').click();
    await expect(page.getByTestId('panel-compare-stations')).toContainText(`${summerClock}`);
    await expect(page.getByTestId('panel-compare-stations')).toContainText(summerLabel);
    await expect(page.getByTestId('panel-compare-stations')).toContainText(winterLabel);
    await page.getByTestId('button-compare-flights').click();
    await openTab(page, 'sources');
    await expect(page.getByTestId('select-global-timezone')).toHaveValue(zone);
    await expect(page.getByTestId('panel-providers')).toContainText(`Jul 15, 2026, ${summerClock} ${period} ${summerLabel}`);
    // Stored ISO times must be unchanged even while all formatted views change.
    const times = await page.evaluate(() => JSON.parse(sessionStorage.getItem('skyguard-telemetry-session-v1')!).map((r: { observedAt: string }) => r.observedAt));
    expect(times).toEqual([winter, summer]);
  }
});
