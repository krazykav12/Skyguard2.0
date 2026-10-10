import assert from "node:assert/strict";
import test from "node:test";
import { parseHourly, parseSites } from "./airnow";

const sites = parseSites([
  "060750005|PM2.5|0005|San Francisco|Active|CA2|Bay Area|R9|37.7749|-122.4194|10.5|-8|US",
  "060750006|PM2.5|0006|Missing coords|Active|CA2|Bay Area|R9|||0|-8|US",
  "060750007|PM2.5|0007|Inactive|Inactive|CA2|Bay Area|R9|37.7749|-122.4194|0|-8|US",
].join("\n"));
const stamp = new Date(Math.floor(Date.now() / 3600_000) * 3600_000);
const date = `${String(stamp.getUTCMonth() + 1).padStart(2, "0")}/${String(stamp.getUTCDate()).padStart(2, "0")}/${String(stamp.getUTCFullYear()).slice(-2)}`;
const hour = `${String(stamp.getUTCHours()).padStart(2, "0")}:00`;
const row = (value: string) => `${date}|${hour}|060750005|San Francisco|-8|PM2.5|UG/M3|${value}|Bay Area`;

test("AirNow sites require active status and reported coordinates", () => {
  assert.equal(sites.size, 1);
  assert.equal(sites.get("060750005")?.elevation, 10.5);
});
test("AirNow timestamps remain UTC, not shifted by the local GMT offset", () => {
  const [record] = parseHourly(row("8.5"), sites, 37.7749, -122.4194, 5);
  assert.equal(record.observedAt, stamp.toISOString());
  assert.equal(record.unit, "µg/m³");
  assert.equal(record.source, "AirNow");
  assert.equal(record.preliminary, true);
  assert.equal(record.value, 8.5);
});
test("Missing/non-numeric values and distant stations are never replaced with zero", () => {
  assert.deepEqual(parseHourly(row(""), sites, 37.7749, -122.4194, 5), []);
  assert.deepEqual(parseHourly(row("invalid"), sites, 37.7749, -122.4194, 5), []);
  assert.deepEqual(parseHourly(row("8.5"), sites, 40.7128, -74.006, 5), []);
});
test("Valid negative raw concentrations remain intact per AirNow's documentation", () => {
  assert.equal(parseHourly(row("-0.4"), sites, 37.7749, -122.4194, 5)[0].value, -0.4);
});
