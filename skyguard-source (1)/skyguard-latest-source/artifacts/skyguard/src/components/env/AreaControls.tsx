import { useEffect, useState } from 'react';
import { LocateFixed, MapPin, RefreshCw } from 'lucide-react';
import { Area, PRESETS } from '@/lib/geo';

type Props = {
  area: Area | null; presetId: string; onApply: (a: Area, presetId: string) => void;
  onLocate: () => void; locating: boolean; locationError: string;
  pollutants: string[]; pollutant: string; onPollutant: (p: string) => void;
  pickMode: boolean; onTogglePick: () => void;
  onRefresh: () => void; refreshing: boolean;
};

export function AreaControls(p: Props) {
  const [lat, setLat] = useState(p.area ? String(p.area.latitude) : '');
  const [lon, setLon] = useState(p.area ? String(p.area.longitude) : '');
  const [rad, setRad] = useState(String(p.area?.radiusKm ?? 25));
  const [err, setErr] = useState('');
  const load = (a: Area) => { setLat(String(a.latitude)); setLon(String(a.longitude)); setRad(String(a.radiusKm)); setErr(''); };
  useEffect(() => { if (p.area) load(p.area); }, [p.area]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = { latitude: Number(lat), longitude: Number(lon), radiusKm: Number(rad) };
    if (lat.trim() === '' || lon.trim() === '' || rad.trim() === '' || !Number.isFinite(a.latitude) || a.latitude < -90 || a.latitude > 90) return setErr('Latitude must be between -90 and 90.');
    if (!Number.isFinite(a.longitude) || a.longitude < -180 || a.longitude > 180) return setErr('Longitude must be between -180 and 180.');
    if (!Number.isFinite(a.radiusKm) || a.radiusKm < 5 || a.radiusKm > 150) return setErr('Radius must be between 5 and 150 km.');
    setErr('');
    const match = PRESETS.find(x => x.latitude === a.latitude && x.longitude === a.longitude);
    p.onApply(a, match ? match.id : 'custom');
  };
  return (
    <section className="panel area-panel" id="monitoring-area">
      <div className="location-request">
        <button type="button" className="btn-primary" onClick={p.onLocate} disabled={p.locating} data-testid="button-use-location"><LocateFixed size={15} />{p.locating ? 'Finding your location…' : p.presetId === 'nearby' ? 'Update my location' : 'Use my location'}</button>
        <p>Your browser will ask permission. Coordinates find nearby stations and weather; they are not sent to analytics. You can also choose an area manually.</p>
      </div>
      {p.locationError && <p className="form-error" role="alert" data-testid="text-location-error">{p.locationError}</p>}
      <form onSubmit={submit} className="area-form" data-testid="form-area">
        <div className="preset-row" role="group" aria-label="Monitoring area presets">
          {PRESETS.map(x => (
            <button type="button" key={x.id} className={`chip ${p.presetId === x.id ? 'is-on' : ''}`} data-testid={`button-preset-${x.id}`}
              onClick={() => { const a = { latitude: x.latitude, longitude: x.longitude, radiusKm: Number(rad) >= 5 && Number(rad) <= 150 ? Number(rad) : p.area?.radiusKm ?? 25 }; load(a); p.onApply(a, x.id); }}>{x.label}</button>
          ))}
          {p.presetId === 'custom' && <span className="chip is-on">Custom area</span>}
          {p.presetId === 'nearby' && <span className="chip is-on">Near me</span>}
        </div>
        <div className="field-row">
          <label className="field"><span>Latitude</span><input className="mono" inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} data-testid="input-latitude" /></label>
          <label className="field"><span>Longitude</span><input className="mono" inputMode="decimal" value={lon} onChange={e => setLon(e.target.value)} data-testid="input-longitude" /></label>
          <label className="field"><span>Radius km (5-150)</span><input className="mono" inputMode="numeric" value={rad} onChange={e => setRad(e.target.value)} data-testid="input-radius" /></label>
          <button type="submit" className="btn-primary" data-testid="button-apply-area">Apply area</button>
        </div>
        {err && <p className="form-error" role="alert" data-testid="text-area-error">{err}</p>}
      </form>
      <div className="field-row tools-row">
        <label className="field"><span>Pollutant</span>
          <select value={p.pollutant} onChange={e => p.onPollutant(e.target.value)} disabled={!p.pollutants.length} data-testid="select-pollutant">
            {p.pollutants.length ? p.pollutants.map(x => <option key={x} value={x}>{x}</option>) : <option>No pollutants returned</option>}
          </select></label>
        <button type="button" className={`btn-soft ${p.pickMode ? 'is-on' : ''}`} aria-pressed={p.pickMode} onClick={p.onTogglePick} data-testid="button-pick-on-map"><MapPin size={13} />{p.pickMode ? 'Click the map to set center' : 'Choose point on map'}</button>
        <button type="button" className="btn-soft" onClick={p.onRefresh} disabled={p.refreshing || !p.area} data-testid="button-refresh">
          <RefreshCw size={13} className={p.refreshing ? 'spin' : ''} /> {p.refreshing ? 'Refreshing' : 'Refresh now'}
        </button>
      </div>
    </section>
  );
}
