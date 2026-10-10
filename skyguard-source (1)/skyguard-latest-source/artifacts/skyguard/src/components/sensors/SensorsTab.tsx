import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { StationObservation } from '@workspace/api-client-react';
import { fmtTime } from '@/lib/geo';
import type { TelemetryStore } from '@/hooks/use-telemetry';
import { SensorPod } from './SensorPod';
import { TelemetryImport } from './TelemetryImport';

type Props = { onHow?: () => void; observations: StationObservation[]; hasArea: boolean; loaded: boolean; zone: string; telemetry: TelemetryStore };

export function SensorsTab({ onHow, observations, hasArea, loaded, zone, telemetry }: Props) {
  const [module, setModule] = useState<'pm25' | 'co2' | 'target-gas'>('pm25');
  const [station, setStation] = useState('all');
  const [pol, setPol] = useState('all');
  const [flight, setFlight] = useState('all');
  const [sensor, setSensor] = useState('all');
  const stations = useMemo(() => Array.from(new Map(observations.map(o => [o.stationId, o.stationName])).entries()), [observations]);
  const pollutants = useMemo(() => Array.from(new Set(observations.map(o => o.pollutant))).sort(), [observations]);
  const rows = useMemo(() => observations.filter(o => (station === 'all' || o.stationId === station) && (pol === 'all' || o.pollutant === pol)).sort((a, b) => a.distanceKm - b.distanceKm), [observations, station, pol]);
  const flights = useMemo(() => Array.from(new Set(telemetry.records.map(r => r.flightId))), [telemetry.records]);
  const sensors = useMemo(() => Array.from(new Set(telemetry.records.filter(r => flight === 'all' || r.flightId === flight).map(r => r.sensorId))), [telemetry.records, flight]);
  // Removed/cleared records must not leave invisible filter values active.
  useEffect(() => {
    if (flight !== 'all' && !flights.includes(flight)) setFlight('all');
    if (sensor !== 'all' && !sensors.includes(sensor)) setSensor('all');
  }, [flight, flights, sensor, sensors]);
  const imported = useMemo(() => telemetry.records.filter(r => (flight === 'all' || r.flightId === flight) && (sensor === 'all' || r.sensorId === sensor)).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)), [telemetry.records, flight, sensor]);
  const importedPollutants = useMemo(() => Array.from(new Set(telemetry.records.map(r => r.pollutant))), [telemetry.records]);
  return (<>
    <section className="panel sensor-data-panel" style={{ marginTop: 0 }} data-testid="panel-station-channels">
      <div className="panel-heading sensor-panel-heading">
        <div><h2 className="panel-title">AirNow ground stations · reported channels</h2><div className="panel-sub">Fixed ground stations, not drones. Each row is a provider-reported concentration with its own observation time.</div></div>
        <div className="sensor-toolbar">
          <label className="sensor-control"><span>Station</span><select aria-label="Filter by station" value={station} onChange={e => setStation(e.target.value)} data-testid="select-sensor-station"><option value="all">All stations</option>{stations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="sensor-control"><span>Pollutant</span><select aria-label="Filter by pollutant channel" value={pol} onChange={e => setPol(e.target.value)} data-testid="select-sensor-pollutant"><option value="all">All pollutants</option>{pollutants.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
        </div>
      </div>
      {rows.length ? (
        <div className="sensor-table-wrap"><table className="sensor-table">
          <thead><tr><th scope="col">Station</th><th scope="col">Pollutant</th><th scope="col">Reported value</th><th scope="col">Observed</th><th scope="col">Distance</th><th scope="col">Source</th><th scope="col">Status</th></tr></thead>
          <tbody>{rows.map(o => (
            <tr key={o.id} data-testid={`station-channel-${o.id}`}>
              <td>{o.stationName}<div>{o.latitude.toFixed(4)}, {o.longitude.toFixed(4)}</div></td>
              <td>{o.pollutant}</td>
              <td className="sensor-value">{o.value} <small>{o.unit}</small></td>
              <td className="sensor-time mono">{fmtTime(o.observedAt, zone)}</td>
              <td className="mono">{o.distanceKm.toFixed(1)} km</td>
              <td>{o.agency} · {o.source}</td>
              <td><span className={`sensor-quality quality-${o.quality === 'outdated' ? 'outdated' : 'measured'}`}>{o.quality === 'outdated' ? 'Outdated' : 'Current'}{o.preliminary ? ' · preliminary' : ''}</span></td>
            </tr>))}</tbody>
        </table></div>
      ) : (
        <div className="sensor-empty" data-testid="empty-station-channels"><strong>{!hasArea ? 'No area selected' : !loaded ? 'No report loaded yet' : 'No matching station channel'}</strong><span>{!hasArea ? 'Choose a location above to load real station channels.' : !loaded ? 'Channels appear once the environment report loads.' : 'Adjust the station or pollutant filter, or choose another area.'}</span></div>
      )}
      <div className="sensor-trace-footnote">Times are the providers' observation times shown in the selected zone. AirNow preliminary hourly data is not AQI. Station elevation is above sea level, not flight altitude.</div>
    </section>

    <div style={{ height: 17 }} />
    <TelemetryImport store={telemetry} />

    <section className="panel sensor-data-panel" style={{ marginTop: 0 }} data-testid="panel-imported-records">
      <div className="panel-heading sensor-panel-heading">
        <div><h2 className="panel-title">Imported drone records</h2><div className="panel-sub">User-provided, unverified, session-local. Not live and not from a connected aircraft.</div></div>
        <div className="sensor-toolbar">
          <label className="sensor-control"><span>Flight</span><select aria-label="Filter by flight" value={flight} onChange={e => { setFlight(e.target.value); setSensor('all'); }} data-testid="select-sensor-flight"><option value="all">All flights</option>{flights.map(f => <option key={f} value={f}>{f}</option>)}</select></label>
          <label className="sensor-control"><span>Sensor</span><select aria-label="Filter by sensor" value={sensor} onChange={e => setSensor(e.target.value)} data-testid="select-sensor-id"><option value="all">All sensors</option>{sensors.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          {flight !== 'all' && <button className="btn-soft" onClick={() => { telemetry.removeFlight(flight); setFlight('all'); setSensor('all'); }} data-testid="button-remove-flight"><Trash2 size={13} />Remove flight</button>}
        </div>
      </div>
      {imported.length ? (
        <div className="sensor-table-wrap"><table className="sensor-table">
          <thead><tr><th scope="col">Flight</th><th scope="col">Sensor</th><th scope="col">Observed</th><th scope="col">Position</th><th scope="col">Value</th><th scope="col">Altitude</th><th scope="col">File</th></tr></thead>
          <tbody>{imported.slice(0, 500).map(r => (
            <tr key={r.id} data-testid={`imported-record-${r.id}`}>
              <td>{r.flightId}</td><td className="mono sensor-id">{r.sensorId}</td>
              <td className="sensor-time mono">{fmtTime(r.observedAt, zone, true)}</td>
              <td className="mono">{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</td>
              <td className="sensor-value">{r.value} <small>{r.unit}</small><span className="sensor-pollutant">{r.pollutant}</span></td>
              <td>{r.altitudeMeters === null ? <span className="empty-read">Not supplied</span> : `${r.altitudeMeters} m ${r.altitudeReference === 'unknown' ? '(reference unknown)' : r.altitudeReference}`}</td>
              <td>{r.sourceFile}</td>
            </tr>))}</tbody>
        </table></div>
      ) : (
        <div className="sensor-empty" data-testid="empty-imported-records"><strong>{telemetry.records.length ? 'No records match these filters' : 'No drone telemetry imported'}</strong><span>{telemetry.records.length ? 'Choose All flights or All sensors.' : 'No drone is connected and no records are assumed. Import your own CSV or JSON above to see them here and in Compare flights.'}</span></div>
      )}
      {imported.length > 500 && <div className="sensor-trace-footnote">Showing the first 500 of {imported.length} matching records.</div>}
    </section>

    <div style={{ height: 17 }} />
    {onHow && <div className="mission-controls" style={{ marginBottom: 12 }}><button className="btn-soft" onClick={onHow} data-testid="button-sensors-how">How does the AeroTrace attachment connect to the drone?</button></div>}
    <SensorPod importedPollutants={importedPollutants} module={module} onModule={setModule} />
  </>);
}
