import { Router, type IRouter } from "express";
import { GetEnvironmentQueryParams, GetEnvironmentResponse, type ProviderStatus, type SatelliteContext } from "@workspace/api-zod";
import { getAirQuality } from "../lib/environment/airnow";
import { getWeather } from "../lib/environment/weather";

const router: IRouter = Router();
const requests = new Map<string, { count: number; until: number }>();

function satelliteContext(latitude: number, longitude: number, radiusKm: number): SatelliteContext | null {
  // GIBS supports global imagery, but this thumbnail bbox must not cross the dateline/poles.
  const latRange = radiusKm / 111, lonRange = latRange / Math.max(.15, Math.cos(latitude * Math.PI / 180));
  if (Math.abs(latitude) + latRange >= 85 || Math.abs(longitude) + lonRange >= 180) return null;
  const date = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  const bbox = [longitude - lonRange, latitude - latRange, longitude + lonRange, latitude + latRange].join(",");
  const query = new URLSearchParams({ service: "WMS", request: "GetMap", version: "1.1.1", srs: "EPSG:4326", layers: "MODIS_Terra_CorrectedReflectance_TrueColor", styles: "", format: "image/jpeg", width: "512", height: "512", bbox, time: date });
  return { imageUrl: `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${query}`, date, sourceUrl: "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api", description: "NASA GIBS MODIS Terra true-color satellite context for the requested UTC date. Cloud cover or no imagery may limit visibility. This is not a ground-level pollutant measurement. Imagery courtesy NASA EOSDIS GIBS." };
}

router.get("/environment", async (req, res): Promise<void> => {
  const ip = req.ip ?? "unknown", now = Date.now(), previous = requests.get(ip);
  const bucket = previous && previous.until > now ? previous : { count: 0, until: now + 60_000 };
  bucket.count++;
  requests.set(ip, bucket);
  if (requests.size > 1024) requests.delete(requests.keys().next().value!);
  if (bucket.count > 30) {
    res.setHeader("Retry-After", Math.ceil((bucket.until - now) / 1000));
    res.status(429).json({ error: "Too many refresh requests. Please wait a minute." }); return;
  }
  if (["latitude", "longitude"].some(key => typeof req.query[key] !== "string" || !(req.query[key] as string).trim())) {
    res.status(400).json({ error: "Latitude and longitude must be provided as numbers." }); return;
  }
  const parsed = GetEnvironmentQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Use valid coordinates and a radius from 5 to 150 km." }); return; }
  const { latitude, longitude, radiusKm } = parsed.data;
  const [air, weather] = await Promise.all([getAirQuality(latitude, longitude, radiusKm), getWeather(latitude, longitude)]);
  const extras: ProviderStatus[] = [
    { id: "openaq", name: "OpenAQ v3", status: "not_configured", message: process.env.OPENAQ_API_KEY ? "A key exists, but OpenAQ is not used; this dashboard uses verified public AirNow measurements." : "Requires an API key; none configured. Public AirNow station files are used instead.", sourceUrl: "https://docs.openaq.org/using-the-api/api-key", refreshedAt: null, nextRefreshAt: null },
    { id: "airnow-api", name: "AirNow authenticated API", status: "not_configured", message: process.env.AIRNOW_API_KEY ? "A key exists; the verified public file feed is used instead of the authenticated API." : "No key configured. Public AirNow data files provide measurements without registration.", sourceUrl: "https://docs.airnowapi.org/", refreshedAt: null, nextRefreshAt: null },
    { id: "nasa", name: "NASA GIBS", status: "context", message: "Public true-color satellite imagery, separate from measured air quality. No Earthdata login required.", sourceUrl: "https://nasa-gibs.github.io/gibs-api-docs/access-basics/", refreshedAt: null, nextRefreshAt: null },
  ];
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(GetEnvironmentResponse.parse({ fetchedAt: new Date().toISOString(), latitude, longitude, radiusKm, observations: air.observations, weather: weather.weather, providers: [air.provider, weather.provider, ...extras], satellite: satelliteContext(latitude, longitude, radiusKm) }));
});

export default router;
