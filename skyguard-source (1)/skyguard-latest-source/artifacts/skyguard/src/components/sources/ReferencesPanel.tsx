import { ExternalLink } from 'lucide-react';

type Ref = { label: string; href: string };
type Group = { title: string; note: string; refs: Ref[]; testId: string };
const GROUPS: Group[] = [
  { testId: 'ref-airnow', title: 'AirNow: station concentrations', note: 'Preliminary hourly concentrations from ground monitors, with agency, location and elevation metadata. These are not AQI and not live onboard drone data. Record-level agency and time are in station details and the Sensors table.', refs: [
    { label: 'AirNow hourly data fact sheet (PDF)', href: 'https://docs.airnowapi.org/docs/HourlyDataFactSheet.pdf' },
    { label: 'AirNow live file-feed index', href: 'https://s3-us-west-1.amazonaws.com/files.airnowtech.org?prefix=airnow/today/&delimiter=/' },
    { label: 'Monitoring site locations file', href: 'https://files.airnowtech.org/airnow/today/monitoring_site_locations.dat' }] },
  { testId: 'ref-nws', title: 'National Weather Service: weather', note: 'Nearest US observation station. Fields the station does not report stay missing and are never filled in.', refs: [
    { label: 'NWS web services documentation', href: 'https://www.weather.gov/documentation/services-web-api' },
    { label: 'api.weather.gov', href: 'https://api.weather.gov/' }] },
  { testId: 'ref-nasa', title: 'NASA EOSDIS GIBS: satellite imagery', note: 'Layer MODIS_Terra_CorrectedReflectance_TrueColor, requested for the current UTC date minus 2 days. Context only, not pollutant concentrations. Clouds or missing images are possible.', refs: [
    { label: 'GIBS API access basics', href: 'https://nasa-gibs.github.io/gibs-api-docs/access-basics/' },
    { label: 'Earthdata GIBS API overview', href: 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api' }] },
  { testId: 'ref-osm', title: 'OpenStreetMap contributors: map tiles', note: 'Street map tiles are loaded from tile.openstreetmap.org, with attribution kept on every map.', refs: [
    { label: 'OpenStreetMap copyright and license', href: 'https://www.openstreetmap.org/copyright' },
    { label: 'Tile server: tile.openstreetmap.org', href: 'https://tile.openstreetmap.org/' }] },
  { testId: 'ref-time', title: 'Time zones', note: 'Eastern and Pacific follow daylight saving automatically; EST and PST options are fixed offsets. Formatting uses the browser Intl API. The current date is never treated as an observation date.', refs: [
    { label: 'IANA time zone database', href: 'https://www.iana.org/time-zones' },
    { label: 'MDN: Intl.DateTimeFormat', href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat' }] },
  { testId: 'ref-notused', title: 'Optional sources, not configured and not used', note: 'No measured data on this site comes from these. Listed so you know what is absent.', refs: [
    { label: 'OpenAQ API keys (not used)', href: 'https://docs.openaq.org/using-the-api/api-key' },
    { label: 'Authenticated AirNow API (not used)', href: 'https://docs.airnowapi.org/' }] },
  { testId: 'ref-credits', title: 'Software and design credits', note: 'Tools and design only. They are not measurement providers. Fonts: Bricolage Grotesque, DM Sans, DM Mono and Manrope from Google Fonts.', refs: [
    { label: 'Leaflet', href: 'https://leafletjs.com/' }, { label: 'React', href: 'https://react.dev/' },
    { label: 'React Icons', href: 'https://react-icons.github.io/react-icons/' }, { label: 'Simple Icons', href: 'https://simpleicons.org/' }] },
];

export function ReferencesPanel() {
  return (
    <section className="panel refs-panel" id="references" data-testid="panel-references" aria-labelledby="refs-title">
      <div className="panel-heading"><div><h2 id="refs-title" className="panel-title">References and citations</h2><div className="panel-sub">Always available, with or without a chosen location. Live provider status appears above once a report loads.</div></div></div>
      <div className="refs-grid">
        {GROUPS.map(g => (
          <div className="ref-group" key={g.testId} data-testid={g.testId}>
            <h3>{g.title}</h3><p>{g.note}</p>
            <ul>{g.refs.map(r => <li key={r.href}><a href={r.href} target="_blank" rel="noopener noreferrer">{r.label}<ExternalLink size={11} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a></li>)}</ul>
          </div>))}
        <div className="ref-group" data-testid="ref-user-imports"><h3>Your imported CSV or JSON</h3><p>Cited by its own file name in the Sensors and Compare views. User-provided, unverified and stored only in this browser tab. Not an independent public provider.</p></div>
        <div className="ref-group" data-testid="ref-aerotrace"><h3>AeroTrace attachment and calculations</h3><p>The mount and pod explanation comes from the project's design notes and the user-described PCV attachment. There is no independent hardware validation, CAD, protocol or connector documentation. Mission priorities and statistics are this app's own calculations on provider and imported records, not a published algorithm and not a dispatched drone. The 3 minutes per stop is an unverified planning assumption.</p></div>
      </div>
    </section>
  );
}
