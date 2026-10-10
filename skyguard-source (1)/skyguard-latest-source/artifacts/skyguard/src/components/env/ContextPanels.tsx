import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { ProviderStatus, SatelliteContext, WeatherObservation } from '@workspace/api-client-react';
import { ageLabel, compass, fmtCoord, fmtTime } from '@/lib/geo';

const MPH = 2.23694;
export function WeatherPanel({ weather, zone, nowMs, unavailable }: { weather: WeatherObservation | null; zone: string; nowMs: number; unavailable: boolean }) {
  return (
    <article className="panel"><div className="panel-heading"><div><h2 className="panel-title">Weather and wind</h2><div className="panel-sub">National Weather Service station observation</div></div></div>
      <div className="adaptive-body" data-testid="panel-weather">
        {!weather ? <div className="sensor-empty"><strong>{unavailable ? 'Weather unavailable' : 'No weather observation'}</strong>No nearby NWS observation was returned. Nothing is substituted.</div> : (<>
          <div className="wind-row">
            <svg width="64" height="64" viewBox="-32 -32 64 64" aria-label={weather.windDirectionDegrees === null ? 'Wind direction not reported' : `Wind from ${compass(weather.windDirectionDegrees)}`}>
              <circle r="29" fill="#edf1e9" stroke="#d6dfd3" />
              {weather.windDirectionDegrees !== null && <path d="M0 -20 L6 8 L0 4 L-6 8Z" fill="#3f8c7a" transform={`rotate(${(weather.windDirectionDegrees + 180) % 360})`} />}
              <text y="-22" fontSize="7" textAnchor="middle" fill="#7d8f85" fontFamily="DM Mono">N</text>
            </svg>
            <div><div className="reading-value" data-testid="text-wind-speed">{weather.windSpeedMps === null ? 'n/r' : weather.windSpeedMps.toFixed(1)}<span className="reading-unit">m/s</span></div>
              <div className="reading-context">{weather.windSpeedMps === null ? '' : `${(weather.windSpeedMps * MPH).toFixed(1)} mph · `}from {compass(weather.windDirectionDegrees)}{weather.windDirectionDegrees === null ? '' : ` (${Math.round(weather.windDirectionDegrees)} deg)`}; arrow shows travel direction</div></div>
          </div>
          <div className="detail-list">
            <div className="detail-item"><label>Gust</label><strong>{weather.windGustMps === null ? 'Not reported' : `${weather.windGustMps.toFixed(1)} m/s`}</strong></div>
            <div className="detail-item"><label>Temperature</label><strong>{weather.temperatureC === null ? 'Not reported' : `${weather.temperatureC.toFixed(1)} C`}</strong></div>
            <div className="detail-item"><label>Humidity</label><strong>{weather.humidityPercent === null ? 'Not reported' : `${weather.humidityPercent.toFixed(0)}%`}</strong></div>
            <div className="detail-item"><label>Conditions</label><strong>{weather.description || 'Not reported'}</strong></div>
            <div className="detail-item"><label>Observed</label><strong>{fmtTime(weather.observedAt, zone)}</strong></div>
            <div className="detail-item"><label>Station</label><strong>{weather.stationName} <span className="mono">{weather.stationId}</span></strong></div>
          </div>
          <p className="mission-note">{fmtCoord(weather.latitude)}, {fmtCoord(weather.longitude)} · {ageLabel(weather.observedAt, nowMs)}{weather.quality === 'outdated' ? ' · OUTDATED observation' : ''} · <a href={weather.sourceUrl} target="_blank" rel="noreferrer">source <ExternalLink size={9} /></a></p>
        </>)}
      </div></article>
  );
}

const STATUS_TEXT: Record<string, string> = { ok: 'OK', stale: 'Stale', unavailable: 'Unavailable', not_configured: 'Not configured', context: 'Context only' };
export function ProviderPanel({ providers, zone }: { providers: ProviderStatus[]; zone: string }) {
  return (
    <section className="panel provenance-panel" id="sources" data-testid="panel-providers">
      <div className="panel-heading"><div><h2 className="panel-title">Data sources and provenance</h2><div className="panel-sub">Every provider reports its own status. Failures stay visible here.</div></div></div>
      <div className="provider-list">
        {providers.length === 0 && <div className="sensor-empty"><strong>No provider metadata</strong>The report listed no providers.</div>}
        {providers.map(p => (
          <div key={p.id} className={`provider provider-${p.status}`} data-testid={`provider-${p.id}`}>
            <span className="provider-badge">{STATUS_TEXT[p.status] ?? p.status}</span>
            <div><strong>{p.name}</strong><p>{p.message}</p>
              <small className="mono">refreshed {fmtTime(p.refreshedAt, zone)} · next {fmtTime(p.nextRefreshAt, zone)}</small></div>
            <a href={p.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${p.name} source`}><ExternalLink size={13} /></a>
          </div>))}
      </div>
    </section>
  );
}

export function SatellitePanel({ satellite }: { satellite: SatelliteContext | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <article className="panel"><div className="panel-heading"><div><h2 className="panel-title">Satellite context</h2><div className="panel-sub">NASA true-color imagery. Visual context only; not a PM2.5 measurement.</div></div></div>
      <div className="adaptive-body" data-testid="panel-satellite">
        {!satellite ? <div className="sensor-empty"><strong>No imagery returned</strong>Context imagery is optional and absent for this report.</div> : failed === satellite.imageUrl ? (
          <div className="sensor-empty" role="alert"><strong>Image failed to load</strong>{satellite.description}<a href={satellite.sourceUrl} target="_blank" rel="noreferrer">Open the NASA source</a></div>
        ) : (<>
          <img className="sat-img" src={satellite.imageUrl} alt={`NASA true-color satellite view, ${satellite.date}`} onError={() => setFailed(satellite.imageUrl)} loading="lazy" data-testid="img-satellite" />
          <p className="mission-note">{satellite.date} · {satellite.description} · <a href={satellite.sourceUrl} target="_blank" rel="noreferrer">NASA source <ExternalLink size={9} /></a></p>
        </>)}
      </div></article>
  );
}
