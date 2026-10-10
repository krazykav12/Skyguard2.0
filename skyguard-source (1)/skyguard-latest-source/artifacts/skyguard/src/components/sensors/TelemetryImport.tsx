import { useRef } from 'react';
import { Download, FileUp, Trash2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { download } from '@/lib/download';
import { TELEMETRY_CSV_HEADERS, TELEMETRY_MAX_BYTES, TELEMETRY_MAX_RECORDS } from '@/lib/telemetry';
import type { TelemetryStore } from '@/hooks/use-telemetry';

const cell = (v: string | number | null) => v === null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
export function recordsCsv(store: TelemetryStore): string {
  return TELEMETRY_CSV_HEADERS + '\n' + store.records.map(r => [r.flightId, r.sensorId, r.observedAt, r.latitude, r.longitude, r.pollutant, r.value, r.unit, r.altitudeMeters, r.altitudeReference === 'unknown' ? '' : r.altitudeReference].map(cell).join(',')).join('\n') + (store.records.length ? '\n' : '');
}

export function TelemetryImport({ store }: { store: TelemetryStore }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="panel area-panel" data-testid="panel-telemetry-import" aria-label="Import drone telemetry">
      <h2 className="panel-title">Import your drone records</h2>
      <p className="mission-note">Choose a CSV or JSON file with your own sensor records. Nothing is generated or filled in: every row needs a timestamp with Z or a UTC offset, latitude, longitude, pollutant, value and unit. Altitude and its reference (AGL or MSL) are optional and stay unavailable when missing. Files up to {TELEMETRY_MAX_BYTES / 1_000_000} MB and {TELEMETRY_MAX_RECORDS} records are accepted. Records stay in this browser tab (session storage), are never uploaded, and are not independently verified. No aircraft is connected.</p>
      <div className="field-row" style={{ marginTop: 10 }}>
        <label className="field"><span>CSV or JSON file</span>
          <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" data-testid="input-telemetry-file"
            onChange={async e => {
              const f = e.target.files?.[0]; if (!f) return;
              const n = await store.importFile(f);
              trackEvent('telemetry_imported', { records: n, success: n > 0, source: 'user_import' });
              if (input.current) input.current.value = '';
            }} /></label>
        <button type="button" className="btn-soft" data-testid="button-download-template" onClick={() => download('skyguard-telemetry-template.csv', TELEMETRY_CSV_HEADERS + '\n', 'text/csv')}><FileUp size={13} />Blank CSV template</button>
        <button type="button" className="btn-soft" disabled={!store.records.length} data-testid="button-export-telemetry" onClick={() => download('skyguard-imported-records.csv', recordsCsv(store), 'text/csv')}><Download size={13} />Export my records</button>
        <button type="button" className="btn-soft" disabled={!store.records.length} data-testid="button-clear-telemetry" onClick={() => { store.clear(); trackEvent('telemetry_cleared', { source: 'user_import' }); }}><Trash2 size={13} />Remove all</button>
      </div>
      {store.error && <p className="form-error" role="alert" data-testid="telemetry-import-error">{store.error}</p>}
      {store.notice && <p className="mission-note" role="status" data-testid="telemetry-import-notice">{store.notice}</p>}
    </section>
  );
}
