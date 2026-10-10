/** User-provided flight records only. No sample readings or flight sessions are generated. */
export type TelemetryRecord = {
  id: string;
  flightId: string;
  sensorId: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  pollutant: string;
  value: number;
  unit: string;
  altitudeMeters: number | null;
  altitudeReference: 'AGL' | 'MSL' | 'unknown';
  sourceFile: string;
};

export const TELEMETRY_CSV_HEADERS = 'flight_id,sensor_id,timestamp,latitude,longitude,pollutant,value,unit,altitude_m,altitude_reference';
export const TELEMETRY_MAX_BYTES = 2_000_000;
export const TELEMETRY_MAX_RECORDS = 5000;

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || !field.trim()) quoted = !quoted;
      else throw new Error('Invalid CSV quoting.');
    } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
      row.push(field.trim()); field = '';
      if (char !== ',') {
        if (row.some(value => value !== '')) rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else field += char;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field.');
  row.push(field.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

function textField(row: Record<string, unknown>, name: string, rowNumber: number): string {
  const value = row[name];
  if (typeof value !== 'string' || !value.trim() || value.length > 160) throw new Error(`Row ${rowNumber}: ${name} must be non-empty text.`);
  return value.trim();
}

function numberField(row: Record<string, unknown>, name: string, rowNumber: number): number {
  const value = row[name];
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) || !Number.isFinite(Number(value))) {
    throw new Error(`Row ${rowNumber}: ${name} must be a reported number.`);
  }
  return Number(value);
}

function timestamp(value: string, rowNumber: number): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/i);
  if (!match) throw new Error(`Row ${rowNumber}: timestamp must be ISO 8601 with Z or an explicit UTC offset.`);
  const [, year, month, day, hour, minute, second, offset] = match;
  const maxDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > maxDay || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 ||
    (offset.toUpperCase() !== 'Z' && (Number(offset.slice(1, 3)) > 14 || Number(offset.slice(4)) > 59 || (Number(offset.slice(1, 3)) === 14 && Number(offset.slice(4)) !== 0)))) {
    throw new Error(`Row ${rowNumber}: invalid timestamp date, time or offset.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Row ${rowNumber}: invalid timestamp.`);
  return date.toISOString();
}

export function parseTelemetry(text: string, filename: string): TelemetryRecord[] {
  if (text.length > TELEMETRY_MAX_BYTES) throw new Error('The file is too large; maximum size is 2 MB.');
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) throw new Error('The file contains no records.');
  let raw: unknown[];
  let firstRow = 1;
  if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
    let data: unknown;
    try { data = JSON.parse(cleaned); } catch { throw new Error('The JSON file is not valid JSON.'); }
    const records = Array.isArray(data) ? data : typeof data === 'object' && data !== null ? (data as Record<string, unknown>).records : null;
    if (!Array.isArray(records)) throw new Error('JSON must contain an array of records or an object with a records array.');
    raw = records;
  } else {
    const rows = csvRows(cleaned);
    const headers = rows.shift()?.map(header => header.toLowerCase()) ?? [];
    const required = TELEMETRY_CSV_HEADERS.split(',').slice(0, 8);
    if (new Set(headers).size !== headers.length) throw new Error('CSV has duplicate column headers.');
    const missing = required.filter(header => !headers.includes(header));
    if (missing.length) throw new Error(`CSV is missing required columns: ${missing.join(', ')}.`);
    firstRow = 2;
    raw = rows.map((row, index) => {
      if (row.length !== headers.length) throw new Error(`Row ${index + 2}: number of values does not match the headers.`);
      return Object.fromEntries(headers.map((header, column) => [header, row[column]]));
    });
  }
  if (!raw.length) throw new Error('The file contains no measurement records. Header-only templates have no readings.');
  if (raw.length > TELEMETRY_MAX_RECORDS) throw new Error(`Maximum ${TELEMETRY_MAX_RECORDS} records per file. No rows have been imported.`);
  return raw.map<TelemetryRecord>((item, index) => {
    const rowNumber = index + firstRow;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error(`Row ${rowNumber}: expected a measurement object.`);
    const row = item as Record<string, unknown>;
    const flightId = textField(row, 'flight_id', rowNumber), sensorId = textField(row, 'sensor_id', rowNumber);
    const latitude = numberField(row, 'latitude', rowNumber), longitude = numberField(row, 'longitude', rowNumber);
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error(`Row ${rowNumber}: coordinates are outside valid ranges.`);
    const observedAt = timestamp(textField(row, 'timestamp', rowNumber), rowNumber);
    const pollutant = textField(row, 'pollutant', rowNumber), unit = textField(row, 'unit', rowNumber);
    const altitudeMeters = row.altitude_m === undefined || row.altitude_m === null || row.altitude_m === '' ? null : numberField(row, 'altitude_m', rowNumber);
    const rawReference = typeof row.altitude_reference === 'string' && row.altitude_reference.trim() ? row.altitude_reference.trim().toUpperCase() : 'UNKNOWN';
    const altitudeReference = rawReference === 'UNKNOWN' ? 'unknown' : rawReference;
    if (altitudeReference !== 'AGL' && altitudeReference !== 'MSL' && altitudeReference !== 'unknown') throw new Error(`Row ${rowNumber}: altitude_reference must be AGL or MSL, or left empty.`);
    return { id: `${filename}:${index}`, flightId, sensorId, observedAt, latitude, longitude, pollutant, value: numberField(row, 'value', rowNumber), unit, altitudeMeters, altitudeReference, sourceFile: filename };
  }).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}
