import { useMemo, useState } from 'react';
import type { StationObservation } from '@workspace/api-client-react';
import type { TelemetryRecord } from '@/lib/telemetry';
import { fmtTime } from '@/lib/geo';
import type { TelemetryStore } from '@/hooks/use-telemetry';
import { PairBars, type PairGroup } from './PairBars';

type Props = { telemetry: TelemetryStore; observations: StationObservation[]; pollutant: string; zone: string; hasArea: boolean; onGoSensors: () => void };
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const stat = (r: TelemetryRecord[]) => r.length ? { n: r.length, mean: mean(r.map(x => x.value)), min: Math.min(...r.map(x => x.value)), max: Math.max(...r.map(x => x.value)), first: r.reduce((m, x) => x.observedAt < m ? x.observedAt : m, r[0].observedAt), last: r.reduce((m, x) => x.observedAt > m ? x.observedAt : m, r[0].observedAt) } : null;

export function CompareTab(p: Props) {
  const [mode, setMode] = useState<'flights' | 'stations'>('flights');
  return (<>
    <section className="panel area-panel" aria-label="Comparison type">
      <div className="preset-row" role="group" aria-label="What to compare" style={{ marginBottom: 0 }}>
        <button className={`chip ${mode === 'flights' ? 'is-on' : ''}`} aria-pressed={mode === 'flights'} onClick={() => setMode('flights')} data-testid="button-compare-flights">Imported flights ({new Set(p.telemetry.records.map(r => r.flightId)).size})</button>
        <button className={`chip ${mode === 'stations' ? 'is-on' : ''}`} aria-pressed={mode === 'stations'} onClick={() => setMode('stations')} data-testid="button-compare-stations">Ground stations (not flights)</button>
      </div>
    </section>
    <div style={{ display: mode === 'flights' ? 'block' : 'none' }}><FlightCompare {...p} /></div>
    <div style={{ display: mode === 'stations' ? 'block' : 'none' }}><StationCompare {...p} /></div>
  </>);
}

function FlightCompare({ telemetry, zone, onGoSensors }: Props) {
  const [primaryId, setPrimaryId] = useState('');
  const [compareId, setCompareId] = useState('');
  const [channel, setChannel] = useState('');
  const [altRef, setAltRef] = useState<'any' | 'AGL' | 'MSL'>('any');
  const flights = useMemo(() => Array.from(new Set(telemetry.records.map(r => r.flightId))), [telemetry.records]);
  const primary = flights.includes(primaryId) ? primaryId : flights[0] ?? '';
  const comparison = flights.includes(compareId) && compareId !== primary ? compareId : flights.find(f => f !== primary) ?? '';
  const of = (id: string) => telemetry.records.filter(r => r.flightId === id);
  const keyOf = (r: TelemetryRecord) => `${r.pollutant}|${r.unit}`;
  const channels = useMemo(() => {
    const a = new Set(of(primary).map(keyOf));
    if (!comparison) return Array.from(a);
    const b = new Set(of(comparison).map(keyOf));
    return Array.from(a).filter(k => b.has(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry.records, primary, comparison]);
  const ch = channels.includes(channel) ? channel : channels[0] ?? '';
  const refsAvail = useMemo(() => ['AGL', 'MSL'].filter(ref => [primary, comparison].some(id => id && of(id).some(r => r.altitudeReference === ref && r.altitudeMeters !== null))) as ('AGL' | 'MSL')[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [telemetry.records, primary, comparison]);
  const ref = altRef === 'any' || refsAvail.includes(altRef) ? altRef : 'any';
  const pick = (id: string) => of(id).filter(r => keyOf(r) === ch && (ref === 'any' || (r.altitudeReference === ref && r.altitudeMeters !== null)));
  const pa = primary ? pick(primary) : [], pc = comparison ? pick(comparison) : [];
  const sa = stat(pa), sc = stat(pc);
  const unit = ch.split('|')[1] ?? '', pol = ch.split('|')[0] ?? '';
  const noAlt = (id: string) => id ? of(id).filter(r => keyOf(r) === ch && r.altitudeMeters === null).length : 0;
  const groups: PairGroup[] = useMemo(() => {
    if (ref === 'any') return [{ label: 'All records', a: sa ? sa.mean : null, b: sc ? sc.mean : null }];
    const bin = (r: TelemetryRecord) => Math.round((r.altitudeMeters as number) / 10) * 10;
    const bins = Array.from(new Set([...pa, ...pc].map(bin))).sort((x, y) => x - y).slice(0, 8);
    return bins.map(b => { const x = pa.filter(r => bin(r) === b), y = pc.filter(r => bin(r) === b); return { label: `${b} m`, a: x.length ? mean(x.map(r => r.value)) : null, b: y.length ? mean(y.map(r => r.value)) : null }; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ch, primary, comparison, telemetry.records]);

  if (!flights.length) return (
    <div className="panel sensor-empty" data-testid="empty-compare-flights" style={{ margin: 0 }}>
      <strong>No flight records imported</strong>
      <span>Flights are never generated. Import your own CSV or JSON on the Sensors tab, then pick a primary and comparison flight here. Meanwhile, the Ground stations view compares real station readings.</span>
      <div><button className="btn-primary" onClick={onGoSensors} data-testid="button-go-import">Go to import</button></div>
    </div>);
  const label = (id: string) => id;
  return (
    <section className="panel comparison-panel" style={{ marginTop: 0 }} data-testid="panel-compare-flights">
      <div className="comparison-head"><div><h2 className="panel-title">Flight comparison · imported records</h2><div className="panel-sub">Only like pollutant and unit, and one altitude reference at a time. User-provided data, not verified.</div></div>
        <div className="compare-pills"><span className="compare-chip">{label(primary)}</span>{comparison && <><span>vs</span><span className="compare-chip alt">{label(comparison)}</span></>}</div></div>
      <div className="field-row" style={{ padding: '4px 20px 10px' }}>
        <label className="field"><span>Primary flight</span><select value={primary} onChange={e => setPrimaryId(e.target.value)} data-testid="select-primary-flight">{flights.map(f => <option key={f} value={f}>{f}</option>)}</select></label>
        <label className="field"><span>Comparison flight</span><select value={comparison} onChange={e => setCompareId(e.target.value)} disabled={flights.length < 2} data-testid="select-comparison-flight">{flights.length < 2 ? <option value="">Import a second flight</option> : flights.filter(f => f !== primary).map(f => <option key={f} value={f}>{f}</option>)}</select></label>
        <label className="field"><span>Pollutant · unit</span><select value={ch} onChange={e => setChannel(e.target.value)} disabled={!channels.length} data-testid="select-compare-channel">{channels.length ? channels.map(k => <option key={k} value={k}>{k.replace('|', ' · ')}</option>) : <option value="">No shared pollutant and unit</option>}</select></label>
        <label className="field"><span>Altitude reference</span><select value={ref} onChange={e => setAltRef(e.target.value as 'any' | 'AGL' | 'MSL')} data-testid="select-compare-altitude"><option value="any">All records (no altitude grouping)</option>{refsAvail.map(r => <option key={r} value={r}>{r} only, grouped by reported altitude</option>)}</select></label>
      </div>
      {!channels.length ? <div className="sensor-empty"><strong>Nothing comparable</strong><span>The selected flights share no pollutant with the same unit. Values in different pollutants or units are never combined.</span></div> : (
        <div className="comparison-inner">
          <div>{groups.some(g => g.a !== null || g.b !== null) ? <PairBars groups={groups} labelA={label(primary)} labelB={comparison ? label(comparison) : null} unit={unit} /> : <div className="sensor-empty"><strong>No records for this selection</strong><span>No measured records match this altitude reference. Records without a reported altitude are excluded from altitude groups.</span></div>}</div>
          <aside className="comparison-notes">
            <table className="sensor-table" style={{ minWidth: 0 }} data-testid="table-flight-stats"><thead><tr><th scope="col">Flight</th><th scope="col">n</th><th scope="col">Mean</th><th scope="col">Min-Max</th></tr></thead><tbody>
              {[[primary, sa], [comparison, sc]].filter(([id]) => id).map(([id, s]) => <tr key={id as string}><td>{id as string}</td>{s ? <><td className="mono">{(s as ReturnType<typeof stat>)!.n}</td><td className="mono">{(s as ReturnType<typeof stat>)!.mean.toFixed(2)}</td><td className="mono">{(s as ReturnType<typeof stat>)!.min}-{(s as ReturnType<typeof stat>)!.max}</td></> : <td colSpan={3}>No records</td>}</tr>)}
            </tbody></table>
            {sa && sc && <div className="compare-big" data-testid="text-flight-difference" style={{ marginTop: 10 }}>{(sa.mean - sc.mean >= 0 ? '+' : '') + (sa.mean - sc.mean).toFixed(2)} <small>{unit} {pol} mean, primary minus comparison</small></div>}
            <p className="compare-desc">{sa ? `Primary: ${fmtTime(sa.first, zone)} to ${fmtTime(sa.last, zone)}.` : ''} {sc ? `Comparison: ${fmtTime(sc.first, zone)} to ${fmtTime(sc.last, zone)}.` : ''}</p>
            <p className="compare-desc">Missing altitude stays unavailable: {noAlt(primary)}{comparison ? ` and ${noAlt(comparison)}` : ''} record(s) have none. AGL and MSL are never mixed; records with an unknown reference only appear under All records.</p>
          </aside>
        </div>)}
      <div className="quality-section"><div className="quality-copy"><strong>Quality notes.</strong> Statistics use only the numeric values you imported. Different flights can differ in time, weather and sensor, so a gap is not evidence of change in local air.</div></div>
    </section>
  );
}

function StationCompare({ observations, pollutant, zone, hasArea }: Props) {
  const stations = useMemo(() => observations.filter(o => o.pollutant === pollutant).sort((a, b) => a.distanceKm - b.distanceKm), [observations, pollutant]);
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const a = stations.find(s => s.id === aId) ?? stations[0];
  const b = stations.find(s => s.id === bId && s.id !== a?.id) ?? stations.find(s => s.id !== a?.id);
  if (stations.length < 1) return (
    <div className="panel sensor-empty" data-testid="empty-compare-stations" style={{ margin: 0 }}><strong>{hasArea ? 'No station readings to compare' : 'No area selected'}</strong><span>{hasArea ? `No ${pollutant || 'pollutant'} stations were returned for this area.` : 'Choose a location above to compare real nearby ground stations.'}</span></div>);
  const same = a && b && a.unit === b.unit;
  return (
    <section className="panel comparison-panel" style={{ marginTop: 0 }} data-testid="panel-compare-stations">
      <div className="comparison-head"><div><h2 className="panel-title">Station comparison · {pollutant}</h2><div className="panel-sub">AirNow ground stations. These are not flights and carry no altitude.</div></div></div>
      <div className="field-row" style={{ padding: '4px 20px 10px' }}>
        <label className="field"><span>Station A</span><select value={a?.id} onChange={e => setAId(e.target.value)} data-testid="select-station-a">{stations.map(s => <option key={s.id} value={s.id}>{s.stationName}</option>)}</select></label>
        <label className="field"><span>Station B</span><select value={b?.id ?? ''} onChange={e => setBId(e.target.value)} disabled={stations.length < 2} data-testid="select-station-b">{stations.length < 2 ? <option value="">Only one station</option> : stations.filter(s => s.id !== a?.id).map(s => <option key={s.id} value={s.id}>{s.stationName}</option>)}</select></label>
      </div>
      <div className="comparison-inner">
        <div>{a && (same || !b) ? <PairBars groups={[{ label: 'Latest value', a: a.value, b: b ? b.value : null }]} labelA={a.stationName} labelB={b?.stationName ?? null} unit={a.unit} /> : <div className="sensor-empty"><strong>Units differ</strong><span>The two stations report different units, so no chart or difference is computed.</span></div>}</div>
        <aside className="comparison-notes">
          {[a, b].filter(Boolean).map(s => <p className="compare-desc" key={s!.id}><strong>{s!.stationName}</strong>: {s!.value} {s!.unit}, observed {fmtTime(s!.observedAt, zone)}, {s!.distanceKm.toFixed(1)} km away{s!.quality === 'outdated' ? ', outdated' : ''}.</p>)}
          {same && b && <div className="compare-big" data-testid="text-station-difference">{(a!.value - b.value >= 0 ? '+' : '') + (a!.value - b.value).toFixed(2)} <small>{a!.unit}, A minus B</small></div>}
        </aside>
      </div>
      <div className="quality-section"><div className="quality-copy"><strong>Quality notes.</strong> Stations report at different observation times; compare the timestamps above. AirNow preliminary hourly values are concentrations, not AQI.</div></div>
    </section>
  );
}
