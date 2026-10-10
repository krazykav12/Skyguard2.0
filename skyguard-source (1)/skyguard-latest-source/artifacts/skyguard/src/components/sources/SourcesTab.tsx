import type { ProviderStatus } from '@workspace/api-client-react';
import { AboutPanel } from './AboutPanel';
import { ReferencesPanel } from './ReferencesPanel';
import { ProviderPanel } from '@/components/env/ContextPanels';

export function SourcesTab({ providers, hasArea, loaded, zone }: { providers: ProviderStatus[]; hasArea: boolean; loaded: boolean; zone: string }) {
  return (<>
    {loaded ? <div id="sources"><ProviderPanel providers={providers} zone={zone} /></div>
      : <div className="panel sensor-empty" data-testid="state-sources-empty" style={{ margin: 0 }}><strong>No provider report yet</strong>{hasArea ? 'The report for your area has not loaded.' : 'Choose a location above to see provider status.'}</div>}
    <section className="panel provenance-panel" data-testid="panel-boundaries"><div className="panel-heading"><div><h2 className="panel-title">What this workspace does and does not know</h2></div></div>
      <div className="adaptive-body"><ul className="boundary-list">
        <li><strong>Station readings</strong> come from AirNow ground stations as the provider reported them, with the provider's observation time. They are preliminary hourly concentrations, not AQI and not real-time onboard telemetry.</li>
        <li><strong>Weather</strong> is the nearest NWS observation. <strong>Satellite imagery</strong> is context only, not a surface pollutant measurement.</li>
        <li><strong>Maps</strong> use OpenStreetMap tiles. Locations are only what you choose: browser location (never sent to analytics), a preset, typed coordinates or a map click.</li>
        <li><strong>Mission plans</strong> are proposals. No drone is connected; sampling time per stop is an unverified assumption; travel, return reserve, wind and aircraft performance are not checked. Planned points have no values. Station elevation is above sea level, not flight altitude.</li>
        <li><strong>Imported drone records</strong> are user-provided, unverified and held only in this browser tab. They are never uploaded and never mixed with station readings. Comparisons use only matching pollutant and unit, and one altitude reference at a time.</li>
        <li><strong>Hardware concepts</strong> (PM2.5, CO2 and target-gas pods) are not measurements. Mount a pod to the frame or a designed payload rail, not the ESC; keep the inlet away from prop wash, heat and vibration. Any gas sensor must be calibrated for its target before its values mean anything.</li>
        <li><strong>Missing data stays missing.</strong> No values are simulated, interpolated or substituted anywhere.</li>
      </ul></div></section>
    <ReferencesPanel />
    <AboutPanel />
    <p className="footnote">Station values are provider-reported concentrations; AirNow preliminary hourly data is not AQI. Planned points are proposals, never measurements.</p>
  </>);
}
