import { useCallback, useRef, useState } from 'react';
import { parseTelemetry, TELEMETRY_MAX_BYTES, TELEMETRY_MAX_RECORDS, type TelemetryRecord } from '@/lib/telemetry';

const KEY = 'skyguard-telemetry-session-v1';
const ok = (r: unknown): r is TelemetryRecord => !!r && typeof r === 'object' && typeof (r as TelemetryRecord).id === 'string' && typeof (r as TelemetryRecord).flightId === 'string' && typeof (r as TelemetryRecord).value === 'number' && typeof (r as TelemetryRecord).observedAt === 'string';
function load(): TelemetryRecord[] {
  try { const a = JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); return Array.isArray(a) ? a.filter(ok).slice(0, TELEMETRY_MAX_RECORDS) : []; } catch { return []; }
}
function save(r: TelemetryRecord[]) { try { sessionStorage.setItem(KEY, JSON.stringify(r)); } catch { /* storage full or blocked: session memory only */ } }

/** User-imported drone records. Session-local to this browser tab; never sent to the server. */
export function useTelemetry() {
  const [records, setRecords] = useState<TelemetryRecord[]>(load);
  const ref = useRef(records);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const importFile = useCallback(async (file: File): Promise<number> => {
    setError(''); setNotice('');
    if (file.size > TELEMETRY_MAX_BYTES) { setError(`${file.name} is larger than ${TELEMETRY_MAX_BYTES / 1_000_000} MB. Split the file and import in parts.`); return 0; }
    try {
      const parsed = parseTelemetry(await file.text(), file.name);
      const ids = new Set(parsed.map(r => r.id));
      const next = [...ref.current.filter(r => !ids.has(r.id)), ...parsed];
      if (next.length > TELEMETRY_MAX_RECORDS) { setError(`Import would exceed ${TELEMETRY_MAX_RECORDS} records in this session. Remove a flight first.`); return 0; }
      ref.current = next; setRecords(next); save(next);
      setNotice(`Imported ${parsed.length} record${parsed.length === 1 ? '' : 's'} from ${file.name}. They are user-provided and stored only in this browser tab.`);
      return parsed.length;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be read.');
      return 0;
    }
  }, []);
  const removeFlight = useCallback((flightId: string) => { const next = ref.current.filter(r => r.flightId !== flightId); ref.current = next; setRecords(next); save(next); }, []);
  const clear = useCallback(() => { ref.current = []; setRecords([]); save([]); setNotice(''); setError(''); }, []);
  return { records, error, notice, importFile, removeFlight, clear, dismiss: () => { setError(''); setNotice(''); } };
}
export type TelemetryStore = ReturnType<typeof useTelemetry>;
