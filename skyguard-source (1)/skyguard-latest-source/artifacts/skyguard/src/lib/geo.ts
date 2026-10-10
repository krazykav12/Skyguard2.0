import type { StationObservation } from '@workspace/api-client-react';

export type Area = { latitude: number; longitude: number; radiusKm: number };
export const PRESETS: { id: string; label: string; latitude: number; longitude: number }[] = [
  { id: 'sf', label: 'San Francisco', latitude: 37.7749, longitude: -122.4194 },
  { id: 'nyc', label: 'New York City', latitude: 40.7128, longitude: -74.006 },
  { id: 'la', label: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
];
export const TIME_ZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern (EST / EDT, automatic)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PST / PDT, automatic)' },
  { value: 'Etc/GMT+5', label: 'EST · UTC−05:00 (fixed)' },
  { value: 'Etc/GMT+8', label: 'PST · UTC−08:00 (fixed)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'device', label: 'Device local time' },
];
export function resolveZone(v: string): string {
  return v === 'device' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : v;
}
export function fmtTime(iso: string | null | undefined, zone: string, seconds = false): string {
  if (!iso) return 'Not reported';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Invalid time';
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: seconds ? '2-digit' : undefined,
    timeZone: resolveZone(zone), timeZoneName: 'short',
  }).formatToParts(d);
  const fixedLabel = zone === 'Etc/GMT+5' ? 'EST' : zone === 'Etc/GMT+8' ? 'PST' : null;
  return parts.map(part => part.type === 'timeZoneName' && fixedLabel ? fixedLabel : part.value).join('');
}
export function ageLabel(iso: string, nowMs: number): string {
  const m = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60000));
  if (m < 60) return `${m} min ago`;
  if (m < 2880) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}
export function bounds(a: Area) {
  const dLat = a.radiusKm / 111.32;
  const dLon = a.radiusKm / (111.32 * Math.max(0.05, Math.cos((a.latitude * Math.PI) / 180)));
  return { minLat: a.latitude - dLat, maxLat: a.latitude + dLat, minLon: a.longitude - dLon, maxLon: a.longitude + dLon };
}
/** Equirectangular projection into a 0..100 square covering the monitoring area. */
export function project(a: Area, lat: number, lon: number) {
  const b = bounds(a);
  return { x: ((lon - b.minLon) / (b.maxLon - b.minLon)) * 100, y: (1 - (lat - b.minLat) / (b.maxLat - b.minLat)) * 100 };
}
export function unproject(a: Area, x: number, y: number) {
  const b = bounds(a);
  return { lon: b.minLon + (x / 100) * (b.maxLon - b.minLon), lat: b.minLat + (1 - y / 100) * (b.maxLat - b.minLat) };
}
export function compass(deg: number | null): string {
  if (deg === null) return 'n/a';
  return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(deg / 22.5) % 16];
}
export function stationsOf(obs: StationObservation[], pollutant: string) {
  return obs.filter(o => o.pollutant === pollutant);
}
export const fmtCoord = (n: number) => n.toFixed(4);
