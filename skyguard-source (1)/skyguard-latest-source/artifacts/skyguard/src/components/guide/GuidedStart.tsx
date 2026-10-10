import { useState } from 'react';
import { Check, Compass, MapPin, Route, X } from 'lucide-react';

const KEY = 'skyguard-guide-dismissed-v1';
const read = () => { try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; } };
const write = (v: boolean) => { try { if (v) window.localStorage.setItem(KEY, '1'); else window.localStorage.removeItem(KEY); } catch { /* storage unavailable: session only */ } };

type Props = { hasArea: boolean; locating: boolean; explored: boolean; planned: boolean; onLocate: () => void; onManual: () => void; onStations: () => void; onPlanner: () => void };

export function GuidedStart(p: Props) {
  const [hidden, setHidden] = useState(read);
  const set = (v: boolean) => { setHidden(v); write(v); };
  if (hidden) return <div className="guide-reopen"><button className="btn-soft" onClick={() => set(false)} data-testid="button-guide-show"><Compass size={13} />Show quick guide</button></div>;
  const steps = [
    { done: p.hasArea, icon: MapPin, title: 'Choose a place', text: 'Pick where to look. Nothing is chosen for you.', actions: <><button className="btn-primary" onClick={p.onLocate} disabled={p.locating} data-testid="button-guide-locate">{p.locating ? 'Finding you' : 'Use my location'}</button><button className="btn-soft" onClick={p.onManual} data-testid="button-guide-manual">Type or pick a place</button></> },
    { done: p.explored, icon: Compass, title: 'Tap a station dot', text: 'Dots are ground-station locations. Green means the reading is current, not that the air is safe.', actions: <button className="btn-soft" onClick={p.onStations} data-testid="button-guide-stations">Go to the station map</button> },
    { done: p.planned, icon: Route, title: 'Sketch a sampling plan', text: 'Propose where a drone could look next. It is a proposal, not a flight.', actions: <button className="btn-soft" onClick={p.onPlanner} data-testid="button-guide-planner">Open the planner</button> },
  ];
  const done = steps.filter(s => s.done).length;
  return (
    <section className="panel guide-panel" data-testid="panel-guide" aria-labelledby="guide-title">
      <div className="guide-head"><div><h2 id="guide-title" className="guide-title">Start here: three steps</h2><p data-testid="text-guide-progress">{done} of 3 done, based on what you have actually done in this visit.</p></div>
        <button className="btn-soft" onClick={() => set(true)} data-testid="button-guide-dismiss" aria-label="Hide quick guide"><X size={13} />Hide</button></div>
      <ol className="guide-steps">{steps.map((s, i) => (
        <li key={s.title} className={s.done ? 'is-done' : ''} data-testid={`guide-step-${i + 1}`} data-done={s.done}>
          <span className="guide-badge">{s.done ? <Check size={15} aria-hidden="true" /> : <s.icon size={15} aria-hidden="true" />}</span>
          <div><b>{i + 1}. {s.title}{s.done && <span className="sr-only"> (done)</span>}</b><p>{s.text}</p><div className="guide-actions">{s.actions}</div></div>
        </li>))}</ol>
      <p className="guide-foot">Values are pollutant concentrations in the unit shown, not AQI scores. Each observation can be hours before the clock above. The time-zone selector changes displayed times, not the measurement instant. If location is blocked, use the manual controls below.</p>
    </section>
  );
}
