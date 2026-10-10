import type { ProviderStatus, StationObservation } from "@workspace/api-zod";
import { cachedText, distanceKm, errorMessage } from "./cache";

const ROOT = "https://files.airnowtech.org/";
const TTL = 15 * 60_000;
const pollutants = new Set(["PM2.5", "PM10", "OZONE", "NO2", "NO2T", "NO2Y", "SO2", "SO2T", "CO", "COT", "NO", "NOX"]);
const unitNames: Record<string, string> = { "UG/M3": "µg/m³", PPB: "ppb", PPM: "ppm" };
type Site = { name: string; latitude: number; longitude: number; elevation: number | null };

export function parseSites(text: string): Map<string, Site> {
  const sites = new Map<string, Site>();
  for (const row of text.split(/\r?\n/)) {
    const fields = row.split("|");
    if (fields.length < 12 || fields[4] !== "Active" || !fields[8]?.trim() || !fields[9]?.trim()) continue;
    const latitude = Number(fields[8]), longitude = Number(fields[9]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    sites.set(fields[0], { name: fields[3], latitude, longitude, elevation: fields[10]?.trim() && Number.isFinite(Number(fields[10])) ? Number(fields[10]) : null });
  }
  return sites;
}

/** AirNow's date/hour are UTC, even when a record also includes a local GMT offset. */
export function parseHourly(text: string, sites: Map<string, Site>, latitude: number, longitude: number, radiusKm: number): StationObservation[] {
  const observations: StationObservation[] = [];
  for (const row of text.split(/\r?\n/)) {
    const f = row.split("|"), site = sites.get(f[2]);
    if (f.length < 9 || !site || !pollutants.has(f[5]) || !f[7]?.trim()) continue;
    const value = Number(f[7]);
    const distance = distanceKm(latitude, longitude, site.latitude, site.longitude);
    if (!Number.isFinite(value) || distance > radiusKm) continue;
    const date = f[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/), hour = f[1].match(/^(\d{2}):(\d{2})$/);
    if (!date || !hour) continue;
    const year = date[3].length === 2 ? 2000 + Number(date[3]) : Number(date[3]);
    const stamp = Date.UTC(year, Number(date[1]) - 1, Number(date[2]), Number(hour[1]), Number(hour[2]));
    if (!Number.isFinite(stamp) || stamp > Date.now() + 3600_000) continue;
    observations.push({
      id: `${f[2]}-${f[5]}`, stationId: f[2], stationName: f[3] || site.name,
      latitude: site.latitude, longitude: site.longitude, elevationMeters: site.elevation,
      pollutant: f[5], value, unit: unitNames[f[6]] ?? f[6], source: "AirNow", agency: f[8],
      observedAt: new Date(stamp).toISOString(), distanceKm: Number(distance.toFixed(2)), preliminary: true,
      quality: Date.now() - stamp > 3 * 3600_000 ? "outdated" : "current",
    });
  }
  return observations;
}

export async function getAirQuality(latitude: number, longitude: number, radiusKm: number): Promise<{ observations: StationObservation[]; provider: ProviderStatus }> {
  const provider: ProviderStatus = { id: "airnow", name: "AirNow public station files", status: "unavailable", message: "", sourceUrl: "https://docs.airnowapi.org/docs/HourlyDataFactSheet.pdf", refreshedAt: null, nextRefreshAt: null };
  try {
    const [listing, metadata] = await Promise.all([
      cachedText("https://s3-us-west-1.amazonaws.com/files.airnowtech.org?prefix=airnow/today/&delimiter=/", TTL, "application/xml"),
      cachedText(`${ROOT}airnow/today/monitoring_site_locations.dat`, 6 * 3600_000),
    ]);
    const paths = [...new Set(listing.text.match(/airnow\/today\/HourlyData_\d{10}\.dat/g) ?? [])].sort().reverse().slice(0, 4);
    if (!paths.length) throw new Error("No hourly observation files are currently published.");
    const sites = parseSites(metadata.text);
    if (!sites.size) throw new Error("Station coordinates are unavailable.");
    const files = await Promise.allSettled(paths.map(path => cachedText(`${ROOT}${path}`, TTL)));
    const observations = new Map<string, StationObservation>();
    let stale = listing.stale || metadata.stale, successes = 0, oldestRefresh = Date.now();
    for (const result of files) {
      if (result.status !== "fulfilled") { stale = true; continue; }
      successes++;
      stale ||= result.value.stale;
      oldestRefresh = Math.min(oldestRefresh, result.value.fetchedAt);
      for (const observation of parseHourly(result.value.text, sites, latitude, longitude, radiusKm)) {
        const previous = observations.get(observation.id);
        if (!previous || observation.observedAt > previous.observedAt) observations.set(observation.id, observation);
      }
    }
    if (!successes) throw new Error("Hourly measurement files could not be retrieved.");
    const records = [...observations.values()].sort((a, b) => a.distanceKm - b.distanceKm || a.pollutant.localeCompare(b.pollutant));
    if (stale) records.forEach(record => { record.quality = "outdated"; });
    provider.status = stale ? "stale" : "ok";
    provider.message = records.length ? `${records.length} station-pollutant readings in ${radiusKm} km. Preliminary hourly concentrations; not AQI or drone measurements.${stale ? " Some provider requests failed; cached or partial data is shown." : ""}` : `No measurements were reported within ${radiusKm} km in the latest four published hours. Try a wider radius.`;
    provider.refreshedAt = new Date(oldestRefresh).toISOString();
    provider.nextRefreshAt = new Date(oldestRefresh + TTL).toISOString();
    return { observations: records, provider };
  } catch (error) {
    provider.message = errorMessage(error);
    return { observations: [], provider };
  }
}
