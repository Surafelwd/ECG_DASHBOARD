import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ECG_CH2_MV_PER_COUNT,
  ecgCh2CountsToMv,
  getUploadStatus,
  parseV1Csv,
} from '../src/lib/telemetry-contract.mjs';
import { sessionIdForPayload } from '../src/lib/ingest-contract.mjs';

const header = 'timestamp,accel_x,accel_y,accel_z,ecg_ch1,ecg_ch2';
const deviceId = 'STM32-0049002D5033500A20353741';

function payload(rows) {
  return [`device_id,${deviceId}`, header, ...rows].join('\r\n');
}

test('parses the exact V1 CSV contract and preserves device uptime', () => {
  const receivedAtMs = Date.parse('2026-09-13T08:00:00.000Z');
  const parsed = parseV1Csv(payload([
    '1000,10,-20,1000,-5,100',
    '1004,11,-19,1001,-4,101',
  ]), receivedAtMs);

  assert.equal(parsed.deviceId, deviceId);
  assert.equal(parsed.readings.length, 2);
  assert.deepEqual(parsed.readings[0], {
    deviceUptimeMs: 1000,
    timestampMs: receivedAtMs - 4,
    accelXMg: 10,
    accelYMg: -20,
    accelZMg: 1000,
    ecgCh1Count: -5,
    ecgCh2Count: 100,
  });
  assert.equal(parsed.durationMs, 4);
});

test('rejects a CSV with the wrong header', () => {
  assert.throws(
    () => parseV1Csv(`device_id,${deviceId}\ntimestamp,x,y,z,ch1,ch2\n0,1,2,3,4,5`, 0),
    /header/i,
  );
});

test('rejects non-finite numeric fields instead of storing NaN', () => {
  assert.throws(
    () => parseV1Csv(payload(['1000,0,0,1000,NaN,100']), 0),
    /finite numeric/i,
  );
});

test('rejects timestamps that do not increase strictly', () => {
  assert.throws(
    () => parseV1Csv(payload([
      '1000,0,0,1000,0,0',
      '1000,0,0,1000,0,0',
    ]), 0),
    /strictly increasing/i,
  );
});

test('converts Channel 2 ADS1292R codes using 2.42 V and gain 6', () => {
  assert.ok(Math.abs(ECG_CH2_MV_PER_COUNT - 0.000048081085850527186) < 1e-15);
  assert.ok(Math.abs(ecgCh2CountsToMv(8_388_607) - 403.3333333333333) < 1e-9);
  assert.equal(ecgCh2CountsToMv(0), 0);
});

test('classifies upload freshness without claiming a live connection', () => {
  const now = Date.parse('2026-09-13T08:10:00.000Z');
  assert.equal(getUploadStatus(null, now).key, 'never');
  assert.equal(getUploadStatus(new Date(now - 30_000).toISOString(), now).key, 'recent');
  assert.equal(getUploadStatus(new Date(now - 3 * 60_000).toISOString(), now).key, 'delayed');
  assert.equal(getUploadStatus(new Date(now - 6 * 60_000).toISOString(), now).key, 'stale');
});

test('derives a stable UUID-shaped session id from device and payload', () => {
  const body = payload(['1000,0,0,1000,0,0']);
  const first = sessionIdForPayload(deviceId, body);
  const second = sessionIdForPayload(deviceId, body);
  const changed = sessionIdForPayload(deviceId, `${body}\r\n1004,0,0,1000,0,1`);

  assert.equal(first, second);
  assert.notEqual(first, changed);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
