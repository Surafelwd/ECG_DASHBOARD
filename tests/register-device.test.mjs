import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { registerDevice } from '../scripts/register-device.mjs';

const id = 'STM32-0049002D5033500A20353941';
const script = new URL('../scripts/register-device.mjs', import.meta.url);

// Only the external PostgreSQL boundary is substituted; no real database is used.
function database(existing = [], inserted = [{ id }]) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/^\s*SELECT/i.test(sql)) return { rows: existing };
      if (/^\s*INSERT/i.test(sql)) return { rows: inserted };
      throw new Error('Unexpected database mutation');
    },
  };
}

test('registers the firmware ID with a separate random API key', async () => {
  const db = database();
  assert.deepEqual(await registerDevice(db, id), { status: 'created', id });
  assert.equal(db.calls.length, 2);
  assert.deepEqual(db.calls[0].params, [id]);
  assert.match(db.calls[0].sql, /id = \$1 OR api_key = \$1 OR serial_number = \$1/);
  assert.match(db.calls[1].sql, /INSERT INTO devices\s*\(id, api_key, serial_number\)/);
  assert.match(db.calls[1].sql, /VALUES \(\$1, \$2, \$1\)/);
  assert.match(db.calls[1].sql, /ON CONFLICT DO NOTHING/);
  assert.equal(db.calls[1].params[0], id);
  assert.match(db.calls[1].params[1], /^[0-9a-f]{64}$/);
});

test('repeat registration preserves an existing device and its metadata', async () => {
  const db = database([{ id, api_key: 'existing-secret', serial_number: id, is_retired: false }]);
  assert.deepEqual(await registerDevice(db, id), { status: 'already_registered', id });
  assert.equal(db.calls.length, 1);
});

test('preserves a device already matched by its API key', async () => {
  const db = database([{ id: 'existing-id', api_key: id, serial_number: 'SN-0001', is_retired: false }]);
  assert.deepEqual(await registerDevice(db, id), { status: 'already_registered', id: 'existing-id' });
  assert.equal(db.calls.length, 1);
});

test('does not reactivate a retired device', async () => {
  const db = database([{ id, api_key: 'secret', serial_number: id, is_retired: true }]);
  await assert.rejects(registerDevice(db, id), /retired/i);
  assert.equal(db.calls.length, 1);
});

test('does not claim a serial-only match is accepted by ingest', async () => {
  const db = database([{ id: 'other-id', api_key: 'secret', serial_number: id, is_retired: false }]);
  await assert.rejects(registerDevice(db, id), /serial number/i);
  assert.equal(db.calls.length, 1);
});

test('refuses ambiguous matches instead of choosing a device', async () => {
  const db = database([
    { id, api_key: 'secret', serial_number: id, is_retired: false },
    { id: 'other-id', api_key: id, serial_number: 'SN-0001', is_retired: false },
  ]);
  await assert.rejects(registerDevice(db, id), /multiple/i);
  assert.equal(db.calls.length, 1);
});

test('a concurrent insertion conflict is not reported as a successful creation', async () => {
  await assert.rejects(registerDevice(database([], []), id), /conflict/i);
});

test('rejects invalid firmware IDs before any database query', async () => {
  for (const invalid of ['', 'SN-0001', id + '0', id.toLowerCase(), "STM32-'; DROP TABLE devices;--"]) {
    const db = database();
    await assert.rejects(registerDevice(db, invalid), /STM32/);
    assert.equal(db.calls.length, 0);
  }
});

test('CLI without an ID fails with usage before loading database dependencies', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(script)], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});
