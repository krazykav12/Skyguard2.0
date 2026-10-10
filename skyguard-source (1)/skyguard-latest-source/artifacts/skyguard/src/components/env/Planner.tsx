import { useState } from 'react';
import { Download } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { download } from '@/lib/download';
import { fmtCoord } from '@/lib/geo';
import { buildPlan, MINUTES_PER_STOP, waypointsCsv, waypointsJson, Plan, PlanInput } from '@/lib/planner';
import type { Area } from '@/lib/geo';
import type { StationObservation } from '@workspace/api-client-react';

const COLORS = ['#3f8c7a', '#d28760', '#6c87a1'];
type Props = { area: Area; pollutant: string; observations: StationObservation[]; plan: Plan | null; onPlan: (p: Plan) => void; canPlan: boolean };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(Number.isFinite(v) ? v : a)));

export function Planner({ area, pollutant, observations, plan, onPlan, canPlan }: Props) {
  const [drones, setDrones] = useState(2);
  const [minutes, setMinutes] = useState(30);
  const [samples, setSamples] = useState(12);
  const [focus, setFocus] = useState(60);
  const [threshold, setThreshold] = useState('');
  const unit = observations.find(o => o.pollutant === pollutant)?.unit ?? '';
  const thresholdNum = threshold.trim() === '' || !Number.isFinite(Number(threshold)) ? null : Number(threshold);
  const input: PlanInput = { area, pollutant, observations, drones, flightMinutes: minutes, sampleBudget: samples, exploreFocus: focus, threshold: thresholdNum };
  const outdated = plan && (plan.input.pollutant !== pollutant || plan.input.area !== area || plan.input.observations !== observations || plan.input.drones !== drones || plan.input.flightMinutes !== minutes || plan.input.sampleBudget !== samples || (plan.input.exploreFocus ?? 60) !== focus || (plan.input.threshold ?? null) !== thresholdNum);
  const stamp = () => new Date().toISOString().slice(0, 10);
  return (
    <article className="panel adaptive-panel" data-testid="panel-planner">
      <div className="panel-heading"><div><h2 className="panel-title">Exploration planner</h2><div className="panel-sub">Planning proposal only. No real drone is connected, nothing is dispatched or flown, and there is no flight progress to show.</div></div><span className="demo-tag">Proposal</span></div>
      <div className="adaptive-body">
        <div className="capacity-controls">
          <label className="capacity-field">Drones (1-3)
            <select value={drones} onChange={e => { const n = Number(e.target.value); setDrones(n); trackEvent('fleet_size_changed', { drones: n, source: 'plan_proposal' }); }} data-testid="select-fleet">{[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="capacity-field">Flight min / drone
            <span className="capacity-input-wrap"><input type="number" min={5} max={90} value={minutes} onChange={e => setMinutes(clamp(Number(e.target.value), 5, 90))} onBlur={() => trackEvent('capacity_changed', { field: 'flight_minutes', value: minutes, source: 'plan_proposal' })} data-testid="input-flight-minutes" /></span></label>
          <label className="capacity-field">Samples / drone
            <span className="capacity-input-wrap"><input type="number" min={2} max={48} value={samples} onChange={e => setSamples(clamp(Number(e.target.value), 2, 48))} onBlur={() => trackEvent('capacity_changed', { field: 'sample_budget', value: samples, source: 'plan_proposal' })} data-testid="input-sample-budget" /></span></label>
          <p className="capacity-assumption">Unverified sampling-time assumption: {MINUTES_PER_STOP} min per stop. Stop cap = lesser of time and sample budget. Travel distance, return-to-base reserve, wind and aircraft performance are not included; this is not a flight-feasibility or safety check.</p>
        </div>
        <div className="planner-controls">
          <div className="focus-control">
            <div className="focus-heading"><label htmlFor="exploration-focus">Exploration balance</label><strong data-testid="text-exploration-focus">{focus}% gap focus</strong></div>
            <input id="exploration-focus" className="focus-range" type="range" min="0" max="100" step="5" value={focus} onChange={e => setFocus(Number(e.target.value))} onPointerUp={() => trackEvent('exploration_balance_changed', { value: focus, source: 'plan_proposal' })} data-testid="input-exploration-focus" />
            <div className="focus-endpoints"><span>Revisit higher station readings</span><span>Explore unmeasured gaps</span></div>
          </div>
          <label className="field"><span>Comparison value{unit ? ` (${unit})` : ''}, optional</span>
            <input className="mono" inputMode="decimal" value={threshold} placeholder="none" onChange={e => setThreshold(e.target.value)} data-testid="input-threshold" /></label>
        </div>
        <p className="mission-note">The comparison value only raises the rank of cells whose station reading meets it. It is your own number, not a regulatory limit, AQI or health guidance.</p>
        <button className="btn-primary" disabled={!canPlan} data-testid="button-generate-plan" onClick={() => { onPlan(buildPlan(input)); trackEvent('plan_generated', { drones, flight_minutes: minutes, sample_budget: samples, pollutant, source: 'plan_proposal' }); }}>Generate proposed plan</button>
        {!canPlan && <p className="mission-note">A plan needs a loaded report for this area.</p>}
        {outdated && <p className="form-error">Planning settings changed. Regenerate the proposal to use the new limits.</p>}
        {plan ? (<>
          <div className="route-list-heading"><div><strong>Initial rectangular coverage</strong><span>planned sampling points, not data stations; values there are unknown until sampled</span></div></div>
          <div className="route-list">{plan.coverage.map(c => (
            <div className="route-card" key={c.drone} data-testid={`card-coverage-${c.drone}`}>
              <span className="route-drone-mark" style={{ background: COLORS[c.drone - 1] }}>D{c.drone}</span>
              <div className="route-card-copy"><strong>Strip {c.drone}: {Math.round(c.rect.w)}% of area width</strong>
                <span className="route-next-stops">{c.stops.length} coverage stops, first at {fmtCoord(c.stops[0].lat)}, {fmtCoord(c.stops[0].lon)}</span></div>
              <span className="route-reason">{plan.perDroneStops} stops max</span></div>))}</div>
          <div className="route-list-heading"><div><strong>Proposed focus areas</strong><span>ranked from {plan.input.pollutant} station readings and coverage gaps</span></div></div>
          <div className="route-list">{plan.focus.length ? plan.focus.map((f, i) => (
            <div className="route-card" key={f.id} data-testid={`card-focus-${f.id}`}>
              <span className="route-drone-mark" style={{ background: '#c06d4b' }}>{i + 1}</span>
              <div className="route-card-copy"><strong>{f.reason === 'gap' ? 'Unmeasured gap' : f.reason === 'outdated' ? 'Only outdated station data' : 'Higher station reading'} · Drone {f.drone}</strong>
                <span className="route-next-stops">{f.reason === 'gap' ? `No station inside this cell${f.nearest ? `; nearest ${f.nearest}` : ''}` : `${f.nearest}: ${f.value} ${f.unit}`}</span></div>
              <span className="route-reason">score {f.score.toFixed(2)}</span></div>))
            : <div className="sensor-empty">No spare budget for focus stops. Raise the sample or flight budget.</div>}</div>
          <p className="algorithm-note">Limited by {plan.limitedBy}. Each drone prioritizes a stronger station-reading cell and a coverage gap when budget allows. Focus proposals re-rank as new provider observations arrive. No concentration is estimated between stations, and no drone commands are sent.</p>
          <div className="mission-controls" style={{ flexWrap: 'wrap' }}>
            <button className="btn-soft" onClick={() => { download(`skyguard-proposed-waypoints-${stamp()}.csv`, waypointsCsv(plan), 'text/csv'); trackEvent('waypoints_exported', { format: 'csv', source: 'plan_proposal' }); }} data-testid="button-export-csv"><Download size={13} />Waypoints CSV</button>
            <button className="btn-soft" onClick={() => { download(`skyguard-proposed-waypoints-${stamp()}.json`, waypointsJson(plan), 'application/json'); trackEvent('waypoints_exported', { format: 'json', source: 'plan_proposal' }); }} data-testid="button-export-json"><Download size={13} />Waypoints JSON</button>
          </div>
          <p className="mission-note">Exports contain proposed latitude/longitude only: no altitude, no measured values at waypoints.</p>
        </>) : <div className="sensor-empty" style={{ marginTop: 12 }}><strong>No plan yet</strong>Generate a proposal to overlay coverage rectangles and focus cells on the street map.</div>}
      </div>
    </article>
  );
}
