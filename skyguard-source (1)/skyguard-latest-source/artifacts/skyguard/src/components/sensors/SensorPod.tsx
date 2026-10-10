import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';

type Mod = { id: 'pm25' | 'co2' | 'target-gas'; name: string; status: string; detail: string; match: (p: string) => boolean };
const MODULES: Mod[] = [
  { id: 'pm25', name: 'PM2.5 particulate', status: 'Hardware concept', detail: 'Particulate sensor configuration. Values appear in this app only from AirNow stations or from records you import.', match: p => /pm/i.test(p) },
  { id: 'co2', name: 'CO\u2082', status: 'Concept only', detail: 'Would require a dedicated CO\u2082 sensor and calibration. No CO\u2082 values come from the station providers; they appear only if you import your own records.', match: p => /co2|co\u2082/i.test(p) },
  { id: 'target-gas', name: 'Target-specific gas', status: 'Sensor + calibration required', detail: 'A gas sensor must be selected for a specific target and calibrated for that use. No target-gas values are provided; imported records only.', match: p => !/pm|co2|co\u2082/i.test(p) },
];

export function SensorPod({ importedPollutants, module, onModule }: { importedPollutants: string[]; module: Mod['id']; onModule: (m: Mod['id']) => void }) {
  const selected = MODULES.find(m => m.id === module) ?? MODULES[0];
  const matching = importedPollutants.filter(selected.match);
  return (
    <article className="panel pod-panel" data-testid="panel-sensor-pod">
      <div className="panel-heading"><div><h2 className="panel-title">Modular sensor pod</h2><div className="panel-sub">A shared frame mount with a replaceable sensing module.</div></div><span className="demo-tag"><span className="pod-status-dot" /> HARDWARE CONCEPT</span></div>
      <div className="pod-body">
        <div className="module-choice-list" role="group" aria-label="Choose a conceptual sensor module">
          {MODULES.map(m => <button key={m.id} className={`module-choice ${module === m.id ? 'is-selected' : ''}`} aria-pressed={module === m.id} data-testid={`button-sensor-module-${m.id}`} onClick={() => { onModule(m.id); trackEvent('sensor_module_selected', { module: m.id, source: 'hardware_concept' }); }}>{m.name}</button>)}
        </div>
        <div className="module-status-card" data-testid="status-selected-sensor-module"><span className="module-status-label">{selected.status}</span><p>{selected.detail}</p></div>
        <p className="mission-note" data-testid="text-module-imported">{matching.length ? `Imported records for this module type: ${matching.join(', ')} (user-provided, unverified).` : 'No imported records for this module type. No values are shown for it.'}</p>
              <div className="pod-schematic">
                <svg viewBox="0 0 560 190" role="img" aria-label="Concept sketch showing a sensor pod mounted to a drone frame rail, separate from the ESC">
                  <g fill="none" stroke="#56776c" strokeWidth="3" strokeLinecap="round">
                    <path d="M166 77 L100 38 M214 77 L280 38 M166 113 L100 152 M214 113 L280 152" />
                    <path d="M230 95 L319 95" stroke="#d28760" strokeWidth="4" />
                  </g>
                  <g fill="#faf9f4" stroke="#9fb4a6" strokeWidth="2">
                    <circle cx="90" cy="32" r="22" /><circle cx="290" cy="32" r="22" />
                    <circle cx="90" cy="158" r="22" /><circle cx="290" cy="158" r="22" />
                  </g>
                  <g fill="#e6ece4" stroke="#56776c" strokeWidth="2">
                    <rect x="145" y="70" width="90" height="50" rx="8" />
                    <rect x="328" y="65" width="190" height="60" rx="12" />
                  </g>
                  <rect x="162" y="85" width="51" height="21" rx="4" fill="#d8e0d7" stroke="#8da398" />
                  <text x="187.5" y="99" textAnchor="middle" fill="#5f7469" fontSize="9" fontFamily="DM Mono">ESC</text>
                  <text x="188" y="134" textAnchor="middle" fill="#6e8579" fontSize="9" fontFamily="DM Mono">DRONE FRAME</text>
                  <text x="423" y="91" textAnchor="middle" fill="#3f655b" fontSize="11" fontWeight="700" fontFamily="DM Sans">REPLACEABLE POD</text>
                  <text x="423" y="108" textAnchor="middle" fill="#7d8e83" fontSize="8" fontFamily="DM Mono">SENSOR · CONTROLLER · INLET</text>
                  <path d="M509 80 L509 110 M501 84 L501 106" stroke="#d28760" strokeWidth="2" />
                  <text x="510" y="143" textAnchor="middle" fill="#a16a4f" fontSize="8" fontFamily="DM Mono">AIR INLET</text>
                  <circle cx="265" cy="95" r="4" fill="#d28760" />
                  <circle cx="308" cy="95" r="4" fill="#d28760" />
                  <path d="M245 84 L245 106 M257 84 L257 106" stroke="#d28760" strokeWidth="2" />
                  <text x="278" y="75" textAnchor="middle" fill="#a16a4f" fontSize="8" fontFamily="DM Mono">FRAME RAIL</text>
                  <path d="M114 31 C130 23 145 22 162 28 M114 157 C132 165 147 167 162 161" stroke="#b9cbbd" strokeWidth="1.5" strokeDasharray="4 4" />
                  <text x="57" y="98" textAnchor="middle" fill="#97a69b" fontSize="8" fontFamily="DM Mono">ROTOR</text>
                </svg>
              </div>
              <div className="pod-key"><span><i className="pod-key-frame" />Drone frame &amp; rail</span><span><i className="pod-key-module" />Swap-in sensing pod</span><span><i className="pod-key-esc" />ESC shown, not a mount</span></div>
              <div className="pod-safety-note">
                <strong>Mount to the frame or a designed payload rail—not the ESC.</strong>
                <span>Keep the inlet away from prop wash, heat, and vibration. Final fit, airflow, payload limits, and connections depend on the aircraft and sensor package selected.</span>
              </div>
              <p className="pod-concept-footnote">Keep the mount interface consistent; choose the pod’s power/data connection and calibration for the selected aircraft and sensor. Concept sketch only—no CAD dimensions or flight hardware are included.</p>
      </div>
    </article>
  );
}
