import type { StationObservation } from '@workspace/api-client-react';
import { Area, project, unproject } from './geo';

export type PlanInput = { area: Area; pollutant: string; observations: StationObservation[]; drones: number; flightMinutes: number; sampleBudget: number; exploreFocus?: number; threshold?: number | null };
export type Rect = { x: number; y: number; w: number; h: number };
export type Coverage = { drone: number; rect: Rect; stops: { x: number; y: number; lat: number; lon: number }[] };
export type Focus = { id: string; rect: Rect; reason: 'gap' | 'elevated' | 'outdated'; score: number; nearest: string | null; value: number | null; unit: string | null; drone: number };
export type Plan = { input: PlanInput; coverage: Coverage[]; focus: Focus[]; perDroneStops: number; minutesPerStop: number; limitedBy: 'flight time' | 'sample budget' };
export const MINUTES_PER_STOP = 3;

export function buildPlan(input: PlanInput): Plan {
  const { area, pollutant, observations, drones, flightMinutes, sampleBudget } = input;
  const w = Math.min(100, Math.max(0, input.exploreFocus ?? 60)) / 100;
  const threshold = input.threshold ?? null;
  const byTime = flightMinutes / MINUTES_PER_STOP;
  const perDroneStops = Math.max(1, Math.floor(Math.min(byTime, sampleBudget)));
  const limitedBy = byTime < sampleBudget ? 'flight time' : 'sample budget';
  const covStops = Math.max(1, Math.ceil(perDroneStops * 0.6));
  const stripW = 100 / drones;
  const coverage: Coverage[] = Array.from({ length: drones }, (_, i) => {
    const rect = { x: i * stripW, y: 0, w: stripW, h: 100 };
    const cols = Math.max(1, Math.ceil(Math.sqrt(covStops * rect.w / rect.h)));
    const rows = Math.max(1, Math.ceil(covStops / cols));
    const stops: Coverage['stops'] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (stops.length >= covStops) break;
      const cc = r % 2 ? cols - 1 - c : c;
      const x = rect.x + ((cc + 0.5) / cols) * rect.w, y = ((r + 0.5) / rows) * 100;
      stops.push({ x, y, ...unproject(area, x, y) });
    }
    return { drone: i + 1, rect, stops };
  });
  // 4x4 cells scored from real station readings of the chosen pollutant only
  const N = 4, size = 100 / N;
  const pts = observations.filter(o => o.pollutant === pollutant).map(o => ({ o, ...project(area, o.latitude, o.longitude) }));
  const max = Math.max(0, ...pts.map(p => p.o.value));
  const cells: Focus[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const rect = { x: c * size, y: r * size, w: size, h: size };
    const cx = rect.x + size / 2, cy = rect.y + size / 2;
    if (Math.hypot(cx - 50, cy - 50) > 62) continue;
    const inside = pts.filter(p => p.x >= rect.x && p.x < rect.x + size && p.y >= rect.y && p.y < rect.y + size);
    const nearest = [...pts].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    const drone = Math.min(drones, Math.floor(cx / stripW) + 1);
    if (!inside.length) {
      const d = nearest ? Math.hypot(nearest.x - cx, nearest.y - cy) / 100 : 1;
      cells.push({ id: `${r}-${c}`, rect, reason: 'gap', score: (0.45 + d * .2) * (0.4 + w), nearest: nearest?.o.stationName ?? null, value: null, unit: null, drone });
    } else {
      const top = inside.sort((a, b) => b.o.value - a.o.value)[0].o;
      const old = inside.every(p => p.o.quality === 'outdated');
      cells.push({ id: `${r}-${c}`, rect, reason: old ? 'outdated' : 'elevated', score: (old ? 0.9 : 0) + ((max ? top.value / max : 0) * 0.8 + (threshold !== null && top.value >= threshold ? 0.4 : 0)) * (1.6 - w), nearest: top.stationName, value: top.value, unit: top.unit, drone });
    }
  }
  cells.sort((a, b) => b.score - a.score);
  const focusSlots = Math.max(0, perDroneStops - covStops);
  const focus: Focus[] = [];
  for (let drone = 1; drone <= drones; drone++) {
    const regional = cells.filter(cell => cell.drone === drone);
    const readings = regional.filter(cell => cell.reason !== 'gap');
    const gaps = regional.filter(cell => cell.reason === 'gap');
    // Preserve both objectives: inspect the strongest station signal and fill a gap.
    const first = readings[0] ?? gaps[0];
    const second = gaps.find(cell => cell !== first) ?? readings.find(cell => cell !== first);
    if (focusSlots > 0 && first) focus.push(first);
    if (focusSlots > 1 && second) focus.push(second);
  }
  focus.sort((a, b) => b.score - a.score);
  return { input, coverage, focus, perDroneStops, minutesPerStop: MINUTES_PER_STOP, limitedBy };
}

export type Waypoint = { drone: number; sequence: number; phase: 'coverage' | 'focus'; latitude: number; longitude: number; reason: string; referenceStation: string; referenceValue: number | null; referenceUnit: string };
const rnd = (n: number) => Number(n.toFixed(5));
export function rectBounds(area: Area, r: Rect): [[number, number], [number, number]] {
  const a = unproject(area, r.x, r.y), b = unproject(area, r.x + r.w, r.y + r.h);
  return [[Math.min(a.lat, b.lat), Math.min(a.lon, b.lon)], [Math.max(a.lat, b.lat), Math.max(a.lon, b.lon)]];
}
/** Proposed waypoints only. Reference values are station readings near the cell, never values at the waypoint. */
export function planWaypoints(plan: Plan): Waypoint[] {
  const out: Waypoint[] = [];
  for (const c of plan.coverage) {
    c.stops.forEach((s, i) => out.push({ drone: c.drone, sequence: i + 1, phase: 'coverage', latitude: rnd(s.lat), longitude: rnd(s.lon), reason: 'initial rectangular sweep', referenceStation: '', referenceValue: null, referenceUnit: '' }));
  }
  for (const c of plan.coverage) {
    let seq = c.stops.length;
    for (const f of plan.focus.filter(x => x.drone === c.drone)) {
      const p = unproject(plan.input.area, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2);
      out.push({ drone: c.drone, sequence: ++seq, phase: 'focus', latitude: rnd(p.lat), longitude: rnd(p.lon), reason: f.reason === 'gap' ? 'unmeasured gap' : f.reason === 'outdated' ? 'only outdated station data' : 'higher station reading', referenceStation: f.nearest ?? '', referenceValue: f.value, referenceUnit: f.unit ?? '' });
    }
  }
  return out;
}
const q = (v: string | number | null) => v === null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
export function waypointsCsv(plan: Plan): string {
  const head = 'drone,sequence,phase,latitude,longitude,reason,reference_station,reference_station_value,reference_unit,pollutant';
  return [head, ...planWaypoints(plan).map(w => [w.drone, w.sequence, w.phase, w.latitude, w.longitude, w.reason, w.referenceStation, w.referenceValue, w.referenceUnit, plan.input.pollutant].map(q).join(','))].join('\n') + '\n';
}
export function waypointsJson(plan: Plan): string {
  return JSON.stringify({
    kind: 'skyguard-planning-proposal', pollutant: plan.input.pollutant,
    notes: ['Proposal only. No aircraft is connected and nothing was dispatched.', 'Waypoints carry no altitude. Station elevation is not flight altitude.', 'Reference values are station readings, not values measured at the waypoint.', `Sampling-time assumption ${plan.minutesPerStop} min per stop; travel, return reserve, wind and aircraft performance are not verified.`],
    waypoints: planWaypoints(plan),
  }, null, 2);
}
