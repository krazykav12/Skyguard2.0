import type { ProviderStatus, WeatherObservation } from "@workspace/api-zod";
import { cachedText, distanceKm, errorMessage } from "./cache";

type Quantity = { value?: number | null; unitCode?: string };
type Feature = { id?: string; geometry?: { coordinates?: number[] }; properties?: {
  observationStations?: string; stationIdentifier?: string; name?: string; timestamp?: string; textDescription?: string;
  temperature?: Quantity; relativeHumidity?: Quantity; windSpeed?: Quantity; windGust?: Quantity; windDirection?: Quantity;
} };
const TTL = 10 * 60_000;
const quantity = (value?: Quantity): number | null => typeof value?.value === "number" && Number.isFinite(value.value) ? value.value : null;
const speed = (value?: Quantity): number | null => {
  const n = quantity(value);
  if (n === null) return null;
  if (value?.unitCode === "wmoUnit:km_h-1") return n / 3.6;
  if (value?.unitCode === "wmoUnit:kt") return n * 0.514444;
  return value?.unitCode === "wmoUnit:m_s-1" ? n : null;
};
function nwsUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "api.weather.gov") throw new Error("Unexpected NWS station URL.");
  return parsed.href;
}

export async function getWeather(latitude: number, longitude: number): Promise<{ weather: WeatherObservation | null; provider: ProviderStatus }> {
  const provider: ProviderStatus = { id: "nws", name: "National Weather Service", status: "unavailable", message: "", sourceUrl: "https://www.weather.gov/documentation/services-web-api", refreshedAt: null, nextRefreshAt: null };
  try {
    const point = await cachedText(`https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`, 24 * 3600_000, "application/geo+json");
    const pointData = JSON.parse(point.text) as Feature;
    if (!pointData.properties?.observationStations) throw new Error("NWS does not provide observations for this area. Coverage is limited to supported US locations.");
    const stations = await cachedText(nwsUrl(pointData.properties.observationStations), 24 * 3600_000, "application/geo+json");
    const stationData = JSON.parse(stations.text) as { features?: Feature[] };
    const nearest = (stationData.features ?? []).filter(s => s.id && s.geometry?.coordinates?.length === 2)
      .sort((a, b) => distanceKm(latitude, longitude, a.geometry!.coordinates![1], a.geometry!.coordinates![0]) - distanceKm(latitude, longitude, b.geometry!.coordinates![1], b.geometry!.coordinates![0])).slice(0, 3);
    if (!nearest.length) throw new Error("No NWS observation stations were found.");
    const candidates = await Promise.allSettled(nearest.map(async station => {
      const url = `${nwsUrl(station.id!)}/observations/latest`;
      const result = await cachedText(url, TTL, "application/geo+json");
      const observation = JSON.parse(result.text) as Feature;
      const props = observation.properties;
      if (!props?.timestamp || !Number.isFinite(Date.parse(props.timestamp))) throw new Error("Weather station has no valid observation timestamp.");
      const coords = observation.geometry?.coordinates ?? station.geometry!.coordinates!;
      const weather: WeatherObservation = {
        stationId: station.properties?.stationIdentifier ?? station.id!.split("/").pop()!,
        stationName: station.properties?.name ?? "NWS station", latitude: coords[1], longitude: coords[0], observedAt: props.timestamp,
        temperatureC: props.temperature?.unitCode === "wmoUnit:degC" ? quantity(props.temperature) : null,
        humidityPercent: quantity(props.relativeHumidity), windSpeedMps: speed(props.windSpeed),
        windDirectionDegrees: quantity(props.windDirection), windGustMps: speed(props.windGust),
        description: props.textDescription ?? "", sourceUrl: url,
        quality: result.stale || Date.now() - Date.parse(props.timestamp) > 3 * 3600_000 ? "outdated" : "current",
      };
      return { weather, result };
    }));
    const usable = candidates.flatMap(candidate => candidate.status === "fulfilled" ? [candidate.value] : []);
    // Prefer a current observation with usable measurements over an empty nearby station.
    usable.sort((a, b) => (b.weather.quality === "current" ? 10 : 0) + (b.weather.windSpeedMps !== null ? 2 : 0) + (b.weather.temperatureC !== null ? 1 : 0) - (a.weather.quality === "current" ? 10 : 0) - (a.weather.windSpeedMps !== null ? 2 : 0) - (a.weather.temperatureC !== null ? 1 : 0));
    const chosen = usable[0];
    if (!chosen) throw new Error("Nearby NWS stations did not return usable observations.");
    provider.status = point.stale || stations.stale || chosen.result.stale ? "stale" : "ok";
    if (provider.status === "stale") chosen.weather.quality = "outdated";
    provider.message = `Observed at ${chosen.weather.stationName}; missing sensor fields remain unavailable. Not a forecast.`;
    provider.refreshedAt = new Date(chosen.result.fetchedAt).toISOString();
    provider.nextRefreshAt = new Date(chosen.result.fetchedAt + TTL).toISOString();
    return { weather: chosen.weather, provider };
  } catch (error) {
    const message = errorMessage(error);
    provider.message = message.includes("HTTP 404") ? "NWS observations are unavailable for this location. This weather provider covers supported US areas only." : message;
    return { weather: null, provider };
  }
}
