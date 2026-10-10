import { logger } from "../logger";

export type CachedText = { text: string; fetchedAt: number; stale: boolean };
type Entry = CachedText & { expiresAt: number };
const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<CachedText>>();
const failures = new Map<string, { until: number; message: string }>();
const USER_AGENT = "SkyGuard/1.0 (public environmental observation dashboard; NWS API consumer)";

/** Shared across visitors; failed requests also get a cooldown to avoid retry storms. */
export async function cachedText(url: string, ttlMs: number, accept = "text/plain"): Promise<CachedText> {
  const now = Date.now();
  const existing = cache.get(url);
  if (existing && existing.expiresAt > now) return existing;
  const failed = failures.get(url);
  if (failed && failed.until > now) {
    if (existing && now - existing.fetchedAt < 24 * 3600_000) return { ...existing, stale: true };
    throw new Error(failed.message);
  }
  const pending = inFlight.get(url);
  if (pending) return pending;
  const request = (async (): Promise<CachedText> => {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        signal: AbortSignal.timeout(12_000),
        redirect: "error",
      });
      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        const seconds = Number(retryAfter);
        const dateMs = retryAfter ? Date.parse(retryAfter) - Date.now() : NaN;
        const delay = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Number.isFinite(dateMs) ? dateMs : 60_000;
        failures.set(url, { until: Date.now() + Math.min(3600_000, Math.max(60_000, delay)), message: response.status === 429 ? "Provider rate limit reached; retry is delayed." : `Provider returned HTTP ${response.status}.` });
        throw new Error(`Provider returned HTTP ${response.status}.`);
      }
      if (Number(response.headers.get("content-length")) > 12_000_000) throw new Error("Provider response was too large.");
      const text = await response.text();
      if (text.length > 12_000_000) throw new Error("Provider response was too large.");
      const entry: Entry = { text, fetchedAt: Date.now(), expiresAt: Date.now() + ttlMs, stale: false };
      cache.delete(url);
      cache.set(url, entry);
      failures.delete(url);
      if (cache.size > 256) cache.delete(cache.keys().next().value!);
      return entry;
    } catch (error) {
      if (!failures.has(url)) failures.set(url, { until: Date.now() + 60_000, message: "Provider could not be reached; retry is delayed." });
      if (failures.size > 256) failures.delete(failures.keys().next().value!);
      logger.warn({ providerHost: new URL(url).hostname, error: error instanceof Error ? error.message : "request_failed" }, "Environmental provider request failed");
      if (existing && now - existing.fetchedAt < 24 * 3600_000) return { ...existing, stale: true };
      throw new Error(failures.get(url)?.message ?? "Provider unavailable.");
    }
  })();
  inFlight.set(url, request);
  try { return await request; } finally { inFlight.delete(url); }
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : "Provider unavailable.";
