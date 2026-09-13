import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('server ingestion is transactional, idempotent, and contains no fabricated measurements', () => {
  const server = read('server.ts');
  const schema = read('src/db/schema.ts');
  assert.match(server, /parseV1Csv/);
  assert.match(server, /sessionIdForPayload/);
  assert.match(server, /db\.transaction/);
  assert.match(server, /duplicate:\s*true/);
  assert.doesNotMatch(server, /avgMagnitude\s*>\s*5/);
  assert.doesNotMatch(server, /batteryLevel:\s*d\.battery_level\s*\?\?\s*100/);
  assert.doesNotMatch(server, /signalStrength:/);
  assert.doesNotMatch(server, /firmwareVersion:\s*'v1\.0\.0'/);
  assert.match(server, /x-battery-millivolts/i);
  assert.match(schema, /battery_voltage_mv/);
});

test('application exposes only data-backed dashboard and recording views', () => {
  const app = read('src/App.tsx');
  for (const unsupported of [
    'demoData',
    'CommandCenter',
    'FleetMapPage',
    'AlarmPage',
    'LoginPage',
    'SignUpPage',
  ]) {
    assert.doesNotMatch(app, new RegExp(unsupported));
  }
});

test('telemetry display identifies the real ECG channel, units, and timing basis', () => {
  const dashboard = read('src/components/TelemetryDashboard.tsx');
  assert.match(dashboard, /RA\s*\/\s*LA differential/i);
  assert.match(dashboard, /AFE noise\s*\/\s*offset reference/i);
  assert.match(dashboard, /elapsed time/i);
  assert.match(dashboard, /ECG_CH2_MV_PER_COUNT|ecgCh2CountsToMv/);
  assert.doesNotMatch(dashboard, /Lead I|Lead II/);
});

test('fleet presents measured battery voltage without inventing a percentage', () => {
  const source = `${read('src/components/DeviceFleetDashboard.tsx')}\n${read('src/components/DevicesPage.tsx')}`;
  assert.match(source, /batteryVoltageMv/);
  assert.match(source, /measured during upload/i);
  assert.doesNotMatch(source, /batteryPercentage|batteryPercent|% battery/i);
});

test('fleet and device screens omit unsupported radio, firmware, command, and AI claims', () => {
  const source = `${read('src/components/DeviceFleetDashboard.tsx')}\n${read('src/components/DevicesPage.tsx')}`;
  for (const unsupported of [
    'signalStrength',
    'firmwareUpdateAvailable',
    'Commands Today',
    'Pulse AI',
    'QRS Complex',
    'Fleet Health',
  ]) {
    assert.doesNotMatch(source, new RegExp(unsupported, 'i'));
  }
});

test('application uses TirtaTrace branding and features the latest upload', () => {
  const source = `${read('src/App.tsx')}\n${read('src/components/DeviceFleetDashboard.tsx')}\n${read('index.html')}`;
  assert.match(source, /TirtaTrace/g);
  assert.match(source, /Latest upload/i);
});
