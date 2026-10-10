import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { AlertTriangle, BookOpen, LocateFixed, Wind } from 'lucide-react';
import { GuidedStart } from '@/components/guide/GuidedStart';
import { LiveOverview } from '@/components/guide/LiveOverview';
import { HowItWorks } from '@/components/sensors/HowItWorks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGetEnvironment } from '@workspace/api-client-react';
import { trackEvent } from '@/lib/analytics';
import { Area, PRESETS, TIME_ZONES, fmtTime, resolveZone } from '@/lib/geo';
import { buildPlan, type Plan } from '@/lib/planner';
import { useTelemetry } from '@/hooks/use-telemetry';
import { AreaControls } from '@/components/env/AreaControls';
import { StationMap } from '@/components/env/StationMap';
import { StationDetail, StationList } from '@/components/env/StationPanels';
import { SatellitePanel, WeatherPanel } from '@/components/env/ContextPanels';
import { MissionsTab } from '@/components/missions/MissionsTab';
import { SensorsTab } from '@/components/sensors/SensorsTab';
import { CompareTab } from '@/components/compare/CompareTab';
import { SourcesTab } from '@/components/sources/SourcesTab';

const TABS = [
  { id: 'live', label: 'Nearby air quality', hint: 'Real stations' },
  { id: 'missions', label: 'Drone missions', hint: 'Street map plan' },
  { id: 'sensors', label: 'Sensors', hint: 'Stations + imports' },
  { id: 'compare', label: 'Compare flights', hint: 'Flights + stations' },
  { id: 'sources', label: 'Data sources', hint: 'Provenance' },
] as const;
type TabId = typeof TABS[number]['id'];

export default function Home() {
  const [tab, setTab] = useState<TabId>(() => ['#about-skyguard', '#references'].includes(window.location.hash) ? 'sources' : 'live');
  const telemetry = useTelemetry();
  const [pickMode, setPickMode] = useState(false);
  const [how, setHow] = useState(() => window.location.hash === '#how-aerotrace');
  const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const openHow = () => { setHow(true); trackEvent('how_aerotrace_opened', { source: 'hardware_concept' }); window.setTimeout(() => document.getElementById('how-aerotrace')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }), 60); };
  useEffect(() => {
    const go = () => { const h = window.location.hash; if (h === '#about-skyguard' || h === '#references') { setTab('sources'); window.setTimeout(() => document.getElementById(h.slice(1))?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }), 120); } };
    go(); window.addEventListener('hashchange', go); return () => window.removeEventListener('hashchange', go);
  }, []);
  const selectTab = (next: string) => { setTab(next as TabId); trackEvent('workspace_tab_selected', { tab: next }); };
  const openSourceSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectTab('sources');
    if (window.location.hash !== `#${id}`) window.history.pushState(window.history.state, '', `#${id}`);
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }), 120);
  };
  const [area, setArea] = useState<Area | null>(null);
  const [presetId, setPresetId] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const locationRequestId = useRef(0);
  const [pollutantPref, setPollutantPref] = useState('PM2.5');
  const [timeZone, setTimeZone] = useState('UTC');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [exploredKey, setExploredKey] = useState('');
  const areaKey = area ? `${area.latitude},${area.longitude},${area.radiusKm}` : '';
  const explored = !!areaKey && exploredKey === areaKey;
  const pickStation = (id: string) => { setSelectedId(id); setExploredKey(areaKey); };
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNowMs(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  const q = useGetEnvironment(area ?? { latitude: 0, longitude: 0, radiusKm: 25 }, { query: { enabled: !!area, refetchInterval: 300000, staleTime: 60000, queryKey: ['/api/environment', area], retry: 1 } });
  const report = q.data;
  const observations = useMemo(() => report?.observations ?? [], [report]);
  const pollutants = useMemo(() => {
    const set = Array.from(new Set(observations.map(o => o.pollutant)));
    return set.sort((a, b) => (a === 'PM2.5' ? -1 : b === 'PM2.5' ? 1 : a.localeCompare(b)));
  }, [observations]);
  const pollutant = pollutants.includes(pollutantPref) ? pollutantPref : pollutants[0] ?? '';
  const stations = useMemo(() => observations.filter(o => o.pollutant === pollutant), [observations, pollutant]);
  const selected = stations.find(s => s.id === selectedId) ?? stations[0] ?? null;
  const siblings = selected ? observations.filter(o => o.stationId === selected.stationId) : [];
  useEffect(() => {
    setPlan(previous => {
      if (!previous) return null;
      if (previous.input.area !== area || previous.input.pollutant !== pollutant) return null;
      if (previous.input.observations === observations) return previous;
      return buildPlan({ ...previous.input, observations });
    });
  }, [area, pollutant, observations]);

  const stale = q.isError && !!report;
  const providers = report?.providers ?? [];
  const bad = providers.filter(p => p.status === 'unavailable' || p.status === 'stale');
  const anyOutdated = observations.some(o => o.quality === 'outdated');
  const noData = !!report && observations.length === 0;
  const zoneLabel = TIME_ZONES.find(z => z.value === timeZone)?.label ?? timeZone;
  const applyArea = (next: Area, id: string) => {
    locationRequestId.current++;
    setLocating(false); setPickMode(false);
    setArea(next); setPresetId(id); setSelectedId(null); setPlan(null); setLocationError('');
    trackEvent('area_preset_selected', { preset: id });
  };
  const pickPoint = (lat: number, lon: number) => { applyArea({ latitude: lat, longitude: lon, radiusKm: area?.radiusKm ?? 25 }, 'custom'); trackEvent('map_point_selected'); };
  const togglePick = () => { const next = !pickMode; setPickMode(next); if (next && tab !== 'live' && tab !== 'missions') selectTab('missions'); };
  const locate = () => {
    if (!navigator.geolocation) {
      setLocationError('This browser does not support location access. Enter coordinates or choose an area below.');
      return;
    }
    setLocating(true);
    setLocationError('');
    const requestId = ++locationRequestId.current;
    navigator.geolocation.getCurrentPosition(position => {
      if (requestId !== locationRequestId.current) return;
      applyArea({ latitude: position.coords.latitude, longitude: position.coords.longitude, radiusKm: area?.radiusKm ?? 25 }, 'nearby');
      setLocating(false);
    }, error => {
      if (requestId !== locationRequestId.current) return;
      setLocating(false);
      setLocationError(error.code === 1
        ? 'Location permission was denied. You can allow it in your browser settings, enter coordinates, or choose a preset. No default location has been substituted.'
        : 'Your browser could not determine your location. Try again, enter coordinates, or choose a preset.');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  };


  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="SkyGuard homepage" data-testid="link-skyguard-home" style={{ textDecoration: 'none' }} onClick={e => {
          if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          selectTab('live');
          setHow(false);
          setPickMode(false);
          window.history.replaceState(window.history.state, '', import.meta.env.BASE_URL);
          window.scrollTo({ top: 0, behavior: scrollBehavior() });
          trackEvent('home_logo_clicked');
        }}><span className="brand-mark"><Wind size={17} strokeWidth={2.2} /></span><span>skyguard</span></a>
        <div className="top-meta">
          <label className="sensor-control"><span>Time zone</span><select aria-label="Display time zone for all tabs" value={timeZone} onChange={e => { setTimeZone(e.target.value); trackEvent('time_zone_selected', { time_zone: e.target.value }); }} data-testid="select-global-timezone">{TIME_ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}</select></label>
          <a className="how-link" href="#how-aerotrace" onClick={e => { e.preventDefault(); openHow(); }} data-testid="link-how-aerotrace">How it works</a>
          <span className="top-date mono" data-testid="text-current-time">NOW · {fmtTime(new Date(nowMs).toISOString(), timeZone, true)}</span>
        </div>
      </header>
      <div className="page-wrap">
        <section className="intro-row hero"><div>
          <div className="eyebrow">SkyGuard · {area ? (presetId === 'nearby' ? 'near your location' : presetId === 'custom' ? 'custom area' : PRESETS.find(p => p.id === presetId)?.label ?? 'selected area') : 'start by choosing a place'}</div>
          <h1 className="page-title display">What is the air doing <em>around you</em>?</h1>
          <p className="intro-copy">Tap the green dots on the map to read real nearby stations, sketch where a drone could look next, and compare your own flights. Times shown in {zoneLabel} ({resolveZone(timeZone)}).</p>
          <div className="hero-actions">
            <button className="btn-hero" onClick={locate} disabled={locating} data-testid="button-hero-locate"><LocateFixed size={16} />{locating ? 'Finding you' : 'Find stations near me'}</button>
            <button className="btn-hero ghost" onClick={openHow} data-testid="button-learn-aerotrace"><BookOpen size={16} />How AeroTrace connects to the drone</button>
          </div>
          <div className="mobile-clock">NOW · {fmtTime(new Date(nowMs).toISOString(), timeZone, true)}</div></div></section>
        {how && <HowItWorks onClose={() => setHow(false)} onGoSensors={() => { setHow(false); selectTab('sensors'); window.requestAnimationFrame(() => document.querySelector('[data-testid="panel-sensors"]')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })); }} />}

        <GuidedStart hasArea={!!area} locating={locating} explored={explored} planned={!!plan} onLocate={locate}
          onManual={() => { const el = document.getElementById('monitoring-area'); el?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); el?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true }); }}
          onStations={() => { selectTab('live'); window.setTimeout(() => document.querySelector('[data-testid="map-stations"]')?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }), 80); }}
          onPlanner={() => { selectTab('missions'); window.setTimeout(() => document.querySelector('[data-testid="panel-missions"]')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }), 80); }} />

        <AreaControls area={area} presetId={presetId} pollutants={pollutants} pollutant={pollutant} pickMode={pickMode} onTogglePick={togglePick}
          onApply={applyArea} onLocate={locate} locating={locating} locationError={locationError}
          onPollutant={p => { setPollutantPref(p); setSelectedId(null); setPlan(null); trackEvent('pollutant_selected', { pollutant: p }); }}
          onRefresh={() => { if (!area) return; trackEvent('manual_refresh'); void q.refetch(); }} refreshing={q.isFetching} />

        <div className="status-stack" data-testid="status-stack">
          {q.isError && <div className="banner banner-error" role="alert" data-testid="banner-error"><AlertTriangle size={14} /><div><strong>{stale ? 'Refresh failed. Showing stale readings from the last successful report.' : 'The environment report could not be loaded.'}</strong><span>{q.error instanceof Error ? q.error.message : 'Request failed.'}</span></div><button className="btn-soft" onClick={() => void q.refetch()} data-testid="button-retry">Retry</button></div>}
          {report && bad.length > 0 && <div className="banner banner-warn" data-testid="banner-partial"><AlertTriangle size={14} /><div><strong>Partial data</strong><span>{bad.map(p => `${p.name}: ${p.status} - ${p.message}`).join(' | ')}</span></div></div>}
          {anyOutdated && <div className="banner banner-warn"><AlertTriangle size={14} /><div><strong>Some readings are outdated</strong><span>They are labeled in the list and drawn in amber on the map.</span></div></div>}
          {report && <div className="fetch-line mono" data-testid="text-fetched">{stale ? 'STALE · ' : ''}Report fetched {fmtTime(report.fetchedAt, timeZone)} · refreshes every 5 min</div>}
        </div>

        <Tabs value={tab} onValueChange={selectTab}>
          <div className="tab-bar-wrap">
            <TabsList className="workspace-tabs" data-testid="workspace-tabs" aria-label="SkyGuard tools">
              {TABS.map(t => <TabsTrigger key={t.id} value={t.id} data-testid={`tab-${t.id}`} className="workspace-tab"><span>{t.label}</span><small>{t.hint}</small></TabsTrigger>)}
            </TabsList>
          </div>
          <TabsContent value="live" forceMount className="tab-pane" data-testid="panel-live">
            <LiveOverview hasArea={!!area} loading={!!area && q.isLoading} error={q.isError || providers.some(p => p.id === 'airnow' && p.status === 'unavailable')} stale={stale || providers.some(p => p.id === 'airnow' && p.status === 'stale')} hasReport={!!report} stationCount={stations.length} pollutant={pollutant} selected={selected} zone={timeZone} nowMs={nowMs} importedCount={telemetry.records.length} planned={!!plan} onRetry={() => void q.refetch()} />
            {!area && <div className="panel sensor-empty" style={{ marginBottom: 17 }} data-testid="state-choose-location"><strong>Where would you like to monitor?</strong>Use my location to request browser permission and find the closest reporting stations. Or enter coordinates, select an area, or choose a point on the map. No location is assumed and no station readings are loaded until you choose.</div>}
            {area && q.isLoading && <div className="layout-grid" data-testid="state-loading"><div className="panel skeleton" style={{ minHeight: 478 }} /><div className="panel skeleton" style={{ minHeight: 478 }} /></div>}
            {area && !q.isLoading && !report && <div className="panel sensor-empty" data-testid="state-unavailable"><strong>No report available</strong>Nothing is shown in place of real measurements. Use Retry once the service is reachable.</div>}
            {noData && <div className="banner banner-warn" data-testid="state-no-observations"><AlertTriangle size={14} /><div><strong>No station observations in this area</strong><span>Providers returned zero readings. Try a larger radius or another area.</span></div></div>}
            {(!area || report) && <section className="layout-grid">
              <article className="panel map-panel">
                <div className="panel-heading"><div><h2 className="panel-title">Nearby stations · {pollutant || 'no pollutant'}</h2><div className="panel-sub">{report ? `${stations.length} station${stations.length === 1 ? '' : 's'} within ${report.radiusKm} km, sorted nearest first. Marker size is relative to the largest value shown.` : 'Choose an area to load stations.'}</div></div></div>
                <StationMap testId="map-stations" area={area} stations={stations} pollutant={pollutant} selectedId={selected?.id ?? null} onSelect={pickStation} weather={report?.weather ?? null} plan={plan} active={tab === 'live'} pickMode={pickMode} onPick={pickPoint} />
                <div className="map-legend"><span><i className="legend-dot" style={{ background: '#3f8c7a' }} />Current station</span><span><i className="legend-dot" style={{ background: '#d5a66c' }} />Outdated station</span><span><i className="legend-dot" style={{ background: '#6c87a1' }} />NWS weather station</span><span><i className="legend-line" />Planned sampling point (proposal)</span></div>
              </article>
              <article className="panel detail-panel"><div className="panel-heading"><div><h2 className="panel-title">Station details</h2></div></div>
                {report ? <StationDetail station={selected} siblings={siblings} zone={timeZone} nowMs={nowMs} /> : <div className="sensor-empty" style={{ margin: 20 }}><strong>No station selected</strong><span>Station details appear once an area loads.</span></div>}</article>
            </section>}
            {report && <>
              <div className="systems-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
                <WeatherPanel weather={report.weather} zone={timeZone} nowMs={nowMs} unavailable={providers.some(p => /weather|nws/i.test(p.id + p.name) && p.status !== 'ok')} />
                <SatellitePanel satellite={report.satellite} />
              </div>
              <StationList stations={stations} selectedId={selected?.id ?? null} onSelect={pickStation} zone={timeZone} nowMs={nowMs} pollutant={pollutant} />
            </>}
          </TabsContent>
          <TabsContent value="missions" forceMount className="tab-pane" data-testid="panel-missions">
            {!area && <div className="panel sensor-empty" style={{ marginBottom: 17 }} data-testid="state-missions-choose"><strong>Where should the plan be?</strong>Choose your location, a San Francisco, New York or Los Angeles preset, typed coordinates, or a point on the map in the controls above. No area is assumed.</div>}
            <MissionsTab area={area} pollutant={pollutant} observations={observations} stations={stations} selected={selected} siblings={siblings} onSelect={pickStation} weather={report?.weather ?? null} plan={plan} onPlan={setPlan} active={tab === 'missions'} pickMode={pickMode} onPick={pickPoint} loaded={!!report} loading={q.isLoading && !!area} zone={timeZone} nowMs={nowMs} />
          </TabsContent>
          <TabsContent value="sensors" forceMount className="tab-pane" data-testid="panel-sensors"><SensorsTab onHow={openHow} observations={observations} hasArea={!!area} loaded={!!report} zone={timeZone} telemetry={telemetry} /></TabsContent>
          <TabsContent value="compare" forceMount className="tab-pane" data-testid="panel-compare"><CompareTab telemetry={telemetry} observations={observations} pollutant={pollutant} zone={timeZone} hasArea={!!area} onGoSensors={() => selectTab('sensors')} /></TabsContent>
          <TabsContent value="sources" forceMount className="tab-pane" data-testid="panel-sources"><SourcesTab providers={providers} hasArea={!!area} loaded={!!report} zone={timeZone} /></TabsContent>
        </Tabs>
        <nav className="site-foot" aria-label="About and references" data-testid="nav-site-foot"><a href="#about-skyguard" onClick={e => openSourceSection(e, 'about-skyguard')}>About and contact</a><a href="#references" onClick={e => openSourceSection(e, 'references')}>Sources and references</a></nav>
      </div>
    </main>
  );
}
