import type { StationObservation } from '@workspace/api-client-react';
import { ageLabel, fmtTime } from '@/lib/geo';

type Props = { hasArea: boolean; loading: boolean; error: boolean; stale: boolean; hasReport: boolean; stationCount: number; pollutant: string; selected: StationObservation | null; zone: string; nowMs: number; importedCount: number; planned: boolean; onRetry: () => void };

export function LiveOverview(p: Props) {
  const s = p.selected;
  let body;
  if (!p.hasArea) body = <State id="location-required" title="Location needed" text="Choose a place above to load real station readings. No area is assumed." />;
  else if (p.loading) body = <div className="skeleton" style={{ minHeight: 92, borderRadius: 12 }} data-testid="overview-loading" aria-busy="true"><span className="sr-only">Loading real station readings</span></div>;
  else if (!p.hasReport || (p.error && !s)) body = <State id="error" title="Readings could not be loaded" text="The air-data request is unavailable. Nothing is substituted for real measurements." action={<button className="btn-soft" onClick={p.onRetry} data-testid="button-overview-retry">Retry</button>} />;
  else if (!s) body = <State id="no-readings" title="No readings for this pollutant" text="No station in this area reported one. Try a larger radius or another place." />;
  else body = (
    <div className="ov-reading" data-testid="overview-reading">
      <div className="ov-main"><span className="ov-label">Selected station · {s.pollutant}</span>
        <div className="ov-value mono" data-testid="overview-value">{Number.isFinite(s.value) ? s.value : 'Not reported'} <small>{Number.isFinite(s.value) ? s.unit : ''}</small></div>
        <div className="ov-name">{s.stationName}</div></div>
      <dl className="ov-facts">
        <div><dt>Observed</dt><dd data-testid="overview-observed">{fmtTime(s.observedAt, p.zone)}</dd></div>
        <div><dt>Age</dt><dd>{ageLabel(s.observedAt, p.nowMs)}</dd></div>
        <div><dt>Distance to area centre</dt><dd>{s.distanceKm.toFixed(1)} km</dd></div>
        <div><dt>Status</dt><dd>{s.quality === 'outdated' ? 'Outdated' : 'Current'}{s.preliminary ? ', preliminary' : ''}</dd></div>
        <div><dt>Source</dt><dd>{s.agency} via {s.source}</dd></div>
      </dl>
      <p className="ov-note">This is one station, not the latest reading across the area. It is a concentration, not an AQI or a health verdict.</p>
    </div>);
  return (
    <section className="panel ov-panel" data-testid="panel-live-overview" aria-label="Live data overview">
      {p.stale && <p className="ov-stale" role="status" data-testid="overview-stale">The air-data refresh is unavailable. These are the last available readings, not a new measurement.</p>}
      {body}
      <div className="ov-scopes" data-testid="overview-scopes">
        <span className="scope public"><b>Public measurements</b>{p.hasReport ? `${p.stationCount} station${p.stationCount === 1 ? '' : 's'} for ${p.pollutant || 'this pollutant'}` : 'none loaded'}</span>
        <span className="scope imports"><b>Your imports, unverified</b>{p.importedCount} record{p.importedCount === 1 ? '' : 's'} in this browser tab, not a live feed</span>
        <span className="scope plan"><b>Mission proposal</b>{p.planned ? 'a proposal exists, not a flight' : 'none yet'}</span>
      </div>
    </section>
  );
}
function State({ id, title, text, action }: { id: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="ov-state" data-testid={`overview-${id}`}><strong>{title}</strong><span>{text}</span>{action}</div>;
}
