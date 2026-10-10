import { Info } from 'lucide-react';
import type { StationObservation, WeatherObservation } from '@workspace/api-client-react';
import type { Area } from '@/lib/geo';
import type { Plan } from '@/lib/planner';
import { StationMap } from '@/components/env/StationMap';
import { StationDetail, StationList } from '@/components/env/StationPanels';
import { Planner } from '@/components/env/Planner';

type Props = {
  area: Area | null; pollutant: string; observations: StationObservation[]; stations: StationObservation[]; selected: StationObservation | null;
  siblings: StationObservation[]; onSelect: (id: string) => void; weather: WeatherObservation | null; plan: Plan | null; onPlan: (p: Plan) => void;
  active: boolean; pickMode: boolean; onPick: (lat: number, lon: number) => void; loaded: boolean; loading: boolean; zone: string; nowMs: number;
};

export function MissionsTab(p: Props) {
  return (<>
    <aside className="lab-banner" data-testid="banner-planning-proposal" role="note">
      <Info size={16} />
      <div><strong>Planning proposal, not dispatch</strong><span>No real drone is connected. Nothing here starts, pauses or flies an aircraft, and there is no flight progress. Planned points are unmeasured: they carry no values. Station readings are real AirNow data for the selected area.</span></div>
    </aside>
    <section className="layout-grid">
      <article className="panel map-panel">
        <div className="panel-heading"><div><h2 className="panel-title">Street map · {p.area ? `${p.stations.length} ${p.pollutant || 'pollutant'} station${p.stations.length === 1 ? '' : 's'}` : 'choose an area'}</h2><div className="panel-sub">Real station positions on OpenStreetMap. Zoom and pan freely; select a station for its reading. Rectangles and numbered points are proposed.</div></div></div>
        <StationMap testId="map-missions" area={p.area} stations={p.stations} pollutant={p.pollutant} selectedId={p.selected?.id ?? null} onSelect={p.onSelect} weather={p.weather} plan={p.plan} active={p.active} pickMode={p.pickMode} onPick={p.onPick} />
        <div className="map-legend"><span><i className="legend-dot" style={{ background: '#3f8c7a' }} />Current station</span><span><i className="legend-dot" style={{ background: '#d5a66c' }} />Outdated station</span><span><i className="legend-dot" style={{ background: '#6c87a1' }} />NWS weather station</span><span><i className="legend-line" />Proposed coverage rectangle and waypoints</span><span><i className="legend-dot" style={{ background: '#c06d4b' }} />Proposed focus cell (F)</span></div>
      </article>
      <article className="panel detail-panel"><div className="panel-heading"><div><h2 className="panel-title">Selected station</h2></div></div>
        {p.selected ? <StationDetail station={p.selected} siblings={p.siblings} zone={p.zone} nowMs={p.nowMs} /> : <div className="sensor-empty" style={{ margin: 20 }} data-testid="empty-mission-station"><strong>{p.area ? (p.loading ? 'Loading real station readings' : 'No station selected') : 'No area selected'}</strong><span>{p.area ? 'Select a station on the map or in the list.' : 'Use my location, a preset, coordinates or Choose point on map in the controls above. No location is assumed.'}</span></div>}
      </article>
    </section>
    <div className="systems-grid" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
      {p.area && p.loaded
        ? <Planner area={p.area} pollutant={p.pollutant} observations={p.observations} plan={p.plan} onPlan={p.onPlan} canPlan />
        : <article className="panel adaptive-panel"><div className="panel-heading"><div><h2 className="panel-title">Exploration planner</h2><div className="panel-sub">Choose an area first. A proposal needs the real station readings for that area.</div></div></div></article>}
    </div>
    {p.loaded && <div style={{ marginTop: 17 }}><StationList stations={p.stations} selectedId={p.selected?.id ?? null} onSelect={p.onSelect} zone={p.zone} nowMs={p.nowMs} pollutant={p.pollutant} /></div>}
  </>);
}
