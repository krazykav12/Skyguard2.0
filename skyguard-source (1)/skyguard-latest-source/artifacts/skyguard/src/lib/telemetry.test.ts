import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTelemetry, TELEMETRY_CSV_HEADERS } from './telemetry';
import { fmtTime } from './geo';

const row = {
  flight_id: 'flight-file-1', sensor_id: 'sensor-1', timestamp: '2026-10-10T13:00:00-04:00',
  latitude: 40.7128, longitude: -74.006, pollutant: 'PM2.5', value: 8.5, unit: 'ug/m3',
};
const json = (overrides: Record<string, unknown> = {}) => JSON.stringify([{ ...row, ...overrides }]);

test('Imports reported fields without inventing altitude; converts an explicit offset to UTC', () => {
  const [record] = parseTelemetry(json(), 'flight.json');
  assert.equal(record.observedAt, '2026-10-10T17:00:00.000Z');
  assert.equal(record.value, 8.5);
  assert.equal(record.latitude, row.latitude);
  assert.equal(record.altitudeMeters, null);
  assert.equal(record.altitudeReference, 'unknown');
  assert.equal(record.sourceFile, 'flight.json');
});
test('CSV quoting and optional altitude reference are preserved', () => {
  const csv = `\uFEFF${TELEMETRY_CSV_HEADERS}\r\n"flight, 1",sensor-1,2026-10-10T17:00:00Z,40.7128,-74.006,PM2.5,-0.4,ug/m3,45,AGL\r\n`;
  const [record] = parseTelemetry(csv, 'flight.csv');
  assert.equal(record.flightId, 'flight, 1');
  assert.equal(record.value, -0.4);
  assert.equal(record.altitudeMeters, 45);
  assert.equal(record.altitudeReference, 'AGL');
});
test('Blank values, impossible coordinates and ambiguous/malformed timestamps fail explicitly', () => {
  for (const value of ['', null, '0x10', true]) assert.throws(() => parseTelemetry(json({ value }), 'flight.json'), /value/);
  assert.throws(() => parseTelemetry(json({ latitude: 100 }), 'flight.json'), /coordinates/);
  assert.throws(() => parseTelemetry(json({ timestamp: '2026-10-10T13:00:00' }), 'flight.json'), /offset/);
  assert.throws(() => parseTelemetry(json({ timestamp: '2026-02-30T13:00:00Z' }), 'flight.json'), /invalid timestamp/);
  assert.equal(parseTelemetry(json({ value: 0 }), 'flight.json')[0].value, 0);
});
test('Headers-only templates and malformed data do not become sample records', () => {
  assert.throws(() => parseTelemetry(TELEMETRY_CSV_HEADERS, 'template.csv'), /no measurement records/);
  assert.throws(() => parseTelemetry('[invalid]', 'flight.json'), /not valid JSON/);
  assert.throws(() => parseTelemetry('value\n5', 'flight.csv'), /missing required columns/);
  assert.throws(() => parseTelemetry(json({ altitude_reference: 'unsupported' }), 'flight.json'), /altitude_reference/);
});
test('UTC, fixed EST/PST and automatic Eastern/Pacific handle actual daylight saving correctly', () => {
  const date = '2026-10-10T17:00:00Z';
  assert.match(fmtTime(date, 'UTC'), /5:00.*UTC/);
  assert.match(fmtTime(date, 'Etc/GMT+5'), /12:00.*EST/);
  assert.match(fmtTime(date, 'Etc/GMT+8'), /9:00.*PST/);
  assert.match(fmtTime(date, 'America/New_York'), /1:00.*EDT/);
  assert.match(fmtTime(date, 'America/Los_Angeles'), /10:00.*PDT/);
  assert.match(fmtTime('2026-12-10T17:00:00Z', 'America/New_York'), /12:00.*EST/);
  assert.match(fmtTime('2026-12-10T17:00:00Z', 'America/Los_Angeles'), /9:00.*PST/);
});
