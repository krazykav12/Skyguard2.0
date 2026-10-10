import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { StationObservation, WeatherObservation } from '@workspace/api-client-react';
import { Area, bounds, fmtCoord } from '@/lib/geo';
import { rectBounds, type Plan } from '@/lib/planner';

const COLORS = ['#3f8c7a', '#d28760', '#6c87a1'];

type Props = {
  area: Area | null; stations: StationObservation[]; pollutant: string; selectedId: string | null; onSelect: (id: string) => void;
  weather: WeatherObservation | null; plan: Plan | null; showPlan?: boolean; active: boolean;
  pickMode: boolean; onPick: (lat: number, lon: number) => void; testId: string;
};

/** Keeps the Leaflet view correct when the pane was hidden (zero size) at mount or becomes visible later. */
function MapSync({ area, active }: { area: Area | null; active: boolean }) {
  const map = useMap();
  const fitted = useRef('');
  const key = area ? `${area.latitude},${area.longitude},${area.radiusKm}` : '';
  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => {
      map.invalidateSize();
      if (area && fitted.current !== key) {
        const b = bounds(area);
        map.fitBounds([[b.minLat, b.minLon], [b.maxLat, b.maxLon]], { animate: false });
        fitted.current = key;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [active, key, area, map]);
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => { if (el.offsetWidth > 0) map.invalidateSize(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}
function PickHandler({ pickMode, onPick }: { pickMode: boolean; onPick: (lat: number, lon: number) => void }) {
  const map = useMap();
  useEffect(() => { map.getContainer().style.cursor = pickMode ? 'crosshair' : ''; }, [pickMode, map]);
  useMapEvents({ click(e) { if (pickMode) onPick(Number(e.latlng.lat.toFixed(4)), Number(((((e.latlng.lng + 180) % 360) + 360) % 360 - 180).toFixed(4))); } });
  return null;
}
const wpIcon = (label: string, color: string, focus: boolean) => L.divIcon({
  className: 'wp-icon', iconSize: [20, 20], iconAnchor: [10, 10],
  html: `<span style="background:${color};${focus ? 'transform:rotate(45deg);border-radius:3px' : 'border-radius:50%'}"><b style="${focus ? 'transform:rotate(-45deg);display:block' : ''}">${label}</b></span>`,
});

export function StationMap({ area, stations, pollutant, selectedId, onSelect, weather, plan, showPlan = true, active, pickMode, onPick, testId }: Props) {
  const max = Math.max(0, ...stations.map(s => s.value));
  const planned = showPlan && plan && area && plan.input.area === area ? plan : null;
  return (
    <div className={`map-visual leaflet-wrap ${pickMode ? 'is-picking' : ''}`} data-testid={testId}>
      <MapContainer center={area ? [area.latitude, area.longitude] : [20, 0]} zoom={area ? 10 : 2} minZoom={2} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <MapSync area={area} active={active} />
        <PickHandler pickMode={pickMode} onPick={onPick} />
        {area && <Circle center={[area.latitude, area.longitude]} radius={area.radiusKm * 1000} pathOptions={{ color: '#4e9880', weight: 1.5, dashArray: '6 6', fill: false }} />}
        {area && <CircleMarker center={[area.latitude, area.longitude]} radius={4} pathOptions={{ color: '#173d37', fillColor: '#fff', fillOpacity: 1, weight: 2 }}><Tooltip>Selected area center ({fmtCoord(area.latitude)}, {fmtCoord(area.longitude)})</Tooltip></CircleMarker>}
        {planned && planned.coverage.map(c => <Rectangle key={`c${c.drone}`} bounds={rectBounds(planned.input.area, c.rect)} pathOptions={{ color: COLORS[c.drone - 1], weight: 1.5, dashArray: '6 4', fillOpacity: 0.07 }}><Tooltip sticky>Proposed coverage strip, drone {c.drone}</Tooltip></Rectangle>)}
        {planned && planned.coverage.map(c => <Polyline key={`l${c.drone}`} positions={c.stops.map(s => [s.lat, s.lon] as [number, number])} pathOptions={{ color: COLORS[c.drone - 1], weight: 2, opacity: .8 }} />)}
        {planned && planned.coverage.flatMap(c => c.stops.map((s, i) => <Marker key={`s${c.drone}-${i}`} position={[s.lat, s.lon]} icon={wpIcon(String(i + 1), COLORS[c.drone - 1], false)} keyboard={false}><Tooltip>Proposed coverage waypoint {i + 1}, drone {c.drone}. Unmeasured: no value.</Tooltip></Marker>))}
        {planned && planned.focus.map(f => <Rectangle key={`f${f.id}`} bounds={rectBounds(planned.input.area, f.rect)} pathOptions={{ color: '#c06d4b', weight: 2, fillColor: '#d28760', fillOpacity: .16 }}><Tooltip sticky>Proposed focus cell, drone {f.drone}: {f.reason === 'gap' ? 'unmeasured gap' : `${f.nearest} ${f.value} ${f.unit}`}</Tooltip></Rectangle>)}
        {planned && planned.focus.map(f => { const lat = rectBounds(planned.input.area, f.rect); return <Marker key={`fw${f.id}`} position={[(lat[0][0] + lat[1][0]) / 2, (lat[0][1] + lat[1][1]) / 2]} icon={wpIcon('F', '#c06d4b', true)} keyboard={false}><Tooltip>Focused waypoint, drone {f.drone}</Tooltip></Marker>; })}
        {weather && <CircleMarker center={[weather.latitude, weather.longitude]} radius={6} pathOptions={{ color: '#fafaf4', weight: 1.5, fillColor: '#6c87a1', fillOpacity: 1 }}><Tooltip>NWS weather station {weather.stationName}</Tooltip></CircleMarker>}
        {stations.map(s => {
          const on = s.id === selectedId;
          return <CircleMarker key={s.id} center={[s.latitude, s.longitude]} radius={7 + (max ? (Math.max(0, s.value) / max) * 7 : 0)}
            ref={marker => {
              const element = marker?.getElement();
              if (element) {
                element.setAttribute('data-testid', `marker-station-${s.id}`);
                element.setAttribute('aria-label', `${s.stationName}: ${s.value} ${s.unit} (${pollutant})`);
              }
            }}
            pathOptions={{ color: on ? '#173d37' : '#fafaf4', weight: on ? 3 : 1.5, fillColor: s.quality === 'outdated' ? '#d5a66c' : '#3f8c7a', fillOpacity: .85 }}
            eventHandlers={{ click: () => { if (!pickMode) onSelect(s.id); } }}>
            <Tooltip>{s.stationName}: {s.value} {s.unit} ({pollutant}) at {fmtCoord(s.latitude)}, {fmtCoord(s.longitude)}</Tooltip>
          </CircleMarker>;
        })}
      </MapContainer>
      {area && !stations.length && <div className="map-empty">No {pollutant || 'pollutant'} stations returned for this area. Nothing is estimated for empty ground.</div>}
      {!area && <div className="map-empty">No area selected. Use location, a preset, coordinates, or Choose point on map above.</div>}
    </div>
  );
}
