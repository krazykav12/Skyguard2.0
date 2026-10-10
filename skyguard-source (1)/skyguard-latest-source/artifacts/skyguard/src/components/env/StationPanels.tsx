import type { StationObservation } from '@workspace/api-client-react';
import { ageLabel, fmtCoord, fmtTime } from '@/lib/geo';

export function StationDetail({ station, siblings, zone, nowMs }: { station: StationObservation | null; siblings: StationObservation[]; zone: string; nowMs: number }) {
  if (!station) return <div className="detail-main"><div className="sensor-empty"><strong>No station selected</strong>Select a station on the grid or in the list to see its measurement and source.</div></div>;
  return (
    <div className="detail-main" data-testid="panel-station-detail">
      <span className={`quality-pill ${station.quality === 'outdated' ? 'quality-outdated' : ''}`}>{station.quality === 'outdated' ? 'Outdated reading' : 'Current reading'}{station.preliminary ? ' · preliminary' : ''}</span>
      <h3 className="selected-loc" data-testid="text-station-name">{station.stationName}</h3>
      <div className="coord">{fmtCoord(station.latitude)}, {fmtCoord(station.longitude)} · {station.distanceKm.toFixed(1)} km from area centre</div>
      <div className="big-reading"><div><span className="reading-value">{station.value}</span><span className="reading-unit">{station.unit}</span><div className="reading-context">{station.pollutant} · observed {ageLabel(station.observedAt, nowMs)}</div></div></div>
      <div className="detail-list">
        <div className="detail-item"><label>Observed</label><strong>{fmtTime(station.observedAt, zone)}</strong></div>
        <div className="detail-item"><label>Station ID</label><strong className="mono">{station.stationId}</strong></div>
        <div className="detail-item"><label>Agency</label><strong>{station.agency}</strong></div>
        <div className="detail-item"><label>Source</label><strong>{station.source}</strong></div>
        <div className="detail-item"><label>Site elevation (above sea level)</label><strong>{station.elevationMeters === null ? 'Not reported' : `${station.elevationMeters} m`}</strong></div>
        <div className="detail-item"><label>Other pollutants here</label><strong>{siblings.filter(s => s.id !== station.id).map(s => `${s.pollutant} ${s.value}`).join(', ') || 'None returned'}</strong></div>
      </div>
      <div className="warning-box">{station.preliminary ? 'Preliminary hourly measurement. It is a concentration, not an Air Quality Index value. ' : 'Reported concentration, not an Air Quality Index value. '}Elevation is the station site above sea level; it is not a drone altitude.</div>
    </div>
  );
}

export function StationList({ stations, selectedId, onSelect, zone, nowMs, pollutant }: { stations: StationObservation[]; selectedId: string | null; onSelect: (id: string) => void; zone: string; nowMs: number; pollutant: string }) {
  const sorted = [...stations].sort((a, b) => a.distanceKm - b.distanceKm);
  return (
    <section className="panel sensor-data-panel">
      <div className="panel-heading"><div><h2 className="panel-title">Station data · {pollutant || 'none'}</h2><div className="panel-sub">{sorted.length} station reading{sorted.length === 1 ? '' : 's'}, nearest first. Timestamps are the providers' observation times.</div></div></div>
      {sorted.length ? (
        <div className="sensor-table-wrap"><table className="sensor-table"><thead><tr><th>Station</th><th>Value</th><th>Observed</th><th>Distance</th><th>Elev. (ASL)</th><th>Agency / source</th><th>Status</th></tr></thead>
          <tbody>{sorted.map(s => (
            <tr key={s.id} className={`row-click ${s.id === selectedId ? 'is-selected' : ''}`} onClick={() => onSelect(s.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onSelect(s.id); }} data-testid={`row-station-${s.id}`}>
              <td><strong>{s.stationName}</strong><div className="sensor-id mono">{s.stationId}</div></td>
              <td className="sensor-value">{s.value} <small>{s.unit}</small></td>
              <td className="sensor-time">{fmtTime(s.observedAt, zone)}<div>{ageLabel(s.observedAt, nowMs)}</div></td>
              <td className="mono">{s.distanceKm.toFixed(1)} km</td>
              <td className="mono">{s.elevationMeters === null ? 'n/r' : `${s.elevationMeters} m`}</td>
              <td>{s.agency}<div className="sensor-id">{s.source}</div></td>
              <td><span className={`sensor-quality ${s.quality === 'outdated' ? 'quality-outdated' : ''}`}>{s.quality === 'outdated' ? 'Outdated' : 'Current'}{s.preliminary ? ' · prelim.' : ''}</span></td>
            </tr>))}</tbody></table></div>
      ) : <div className="sensor-empty"><strong>No station readings</strong>The providers returned no {pollutant || 'pollutant'} measurements inside this area. Try a larger radius.</div>}
      <p className="sensor-trace-footnote">Preliminary values are unvalidated and are not AQI. Elevation is above sea level at the station.</p>
    </section>
  );
}
