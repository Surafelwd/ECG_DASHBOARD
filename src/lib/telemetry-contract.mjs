export const V1_CSV_HEADER = 'timestamp,accel_x,accel_y,accel_z,ecg_ch1,ecg_ch2';
export const MAX_BATCH_SIZE = 5000;
export const EXPECTED_V1_SAMPLE_COUNT = 2500;
export const ECG_CH2_MV_PER_COUNT = (2.42 / 6 / (2 ** 23 - 1)) * 1000;

const DEVICE_ID_PATTERN = /^STM32-[0-9A-F]{24}$/;
const UINT32_RANGE = 2 ** 32;

function parseFiniteNumber(value, rowIndex, fieldName) {
  if (value === '' || !Number.isFinite(Number(value))) {
    throw new Error(`Row ${rowIndex}: ${fieldName} must be a finite numeric value`);
  }
  return Number(value);
}

export function parseV1Csv(csvText, receivedAtMs = Date.now()) {
  if (typeof csvText !== 'string' || csvText.trim() === '') {
    throw new Error('CSV payload is empty');
  }
  if (!Number.isFinite(receivedAtMs)) {
    throw new Error('Receipt time must be finite');
  }

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 3) {
    throw new Error('CSV payload must include device identity, header, and readings');
  }

  const identity = lines[0].split(',').map((value) => value.trim());
  if (identity.length !== 2 || identity[0] !== 'device_id' || !DEVICE_ID_PATTERN.test(identity[1])) {
    throw new Error('CSV device_id must match STM32- followed by 24 uppercase hexadecimal digits');
  }
  if (lines[1].trim() !== V1_CSV_HEADER) {
    throw new Error(`CSV header must be exactly: ${V1_CSV_HEADER}`);
  }

  const dataLines = lines.slice(2);
  if (dataLines.length > MAX_BATCH_SIZE) {
    throw new Error(`CSV payload exceeds the ${MAX_BATCH_SIZE}-reading limit`);
  }

  let previousRawUptime = null;
  let previousUptime = null;
  let wrapOffset = 0;
  const parsedRows = dataLines.map((line, index) => {
    const rowNumber = index + 1;
    const fields = line.split(',').map((value) => value.trim());
    if (fields.length !== 6) {
      throw new Error(`Row ${rowNumber}: expected exactly 6 columns`);
    }

    const rawUptime = parseFiniteNumber(fields[0], rowNumber, 'timestamp');
    if (!Number.isInteger(rawUptime) || rawUptime < 0 || rawUptime >= UINT32_RANGE) {
      throw new Error(`Row ${rowNumber}: timestamp must be an unsigned 32-bit integer`);
    }

    if (previousRawUptime !== null && rawUptime <= previousRawUptime) {
      const wrapped = previousRawUptime - rawUptime > UINT32_RANGE / 2;
      if (!wrapped) {
        throw new Error(`Row ${rowNumber}: timestamps must be strictly increasing`);
      }
      wrapOffset += UINT32_RANGE;
    }

    const unwrappedUptime = rawUptime + wrapOffset;
    if (previousUptime !== null && unwrappedUptime <= previousUptime) {
      throw new Error(`Row ${rowNumber}: timestamps must be strictly increasing`);
    }
    previousRawUptime = rawUptime;
    previousUptime = unwrappedUptime;

    return {
      deviceUptimeMs: unwrappedUptime,
      accelXMg: parseFiniteNumber(fields[1], rowNumber, 'accel_x'),
      accelYMg: parseFiniteNumber(fields[2], rowNumber, 'accel_y'),
      accelZMg: parseFiniteNumber(fields[3], rowNumber, 'accel_z'),
      ecgCh1Count: parseFiniteNumber(fields[4], rowNumber, 'ecg_ch1'),
      ecgCh2Count: parseFiniteNumber(fields[5], rowNumber, 'ecg_ch2'),
    };
  });

  const endUptime = parsedRows.at(-1).deviceUptimeMs;
  const readings = parsedRows.map((row) => ({
    deviceUptimeMs: row.deviceUptimeMs,
    timestampMs: receivedAtMs - (endUptime - row.deviceUptimeMs),
    accelXMg: row.accelXMg,
    accelYMg: row.accelYMg,
    accelZMg: row.accelZMg,
    ecgCh1Count: row.ecgCh1Count,
    ecgCh2Count: row.ecgCh2Count,
  }));

  return {
    deviceId: identity[1],
    readings,
    durationMs: endUptime - parsedRows[0].deviceUptimeMs,
    deviceUptimeStartMs: parsedRows[0].deviceUptimeMs,
    deviceUptimeEndMs: endUptime,
    receivedAtMs,
  };
}

export function ecgCh2CountsToMv(rawCount) {
  return rawCount * ECG_CH2_MV_PER_COUNT;
}

export function parseBatteryMillivolts(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const millivolts = Number(value);
  return Number.isSafeInteger(millivolts) && millivolts >= 2500 && millivolts <= 5000
    ? millivolts
    : null;
}

export function getUploadStatus(lastSync, nowMs = Date.now()) {
  if (!lastSync) return { key: 'never', label: 'No uploads', ageMs: null };
  const lastSyncMs = new Date(lastSync).getTime();
  if (!Number.isFinite(lastSyncMs)) return { key: 'never', label: 'No uploads', ageMs: null };

  const ageMs = Math.max(0, nowMs - lastSyncMs);
  if (ageMs < 2 * 60_000) return { key: 'recent', label: 'Recent', ageMs };
  if (ageMs < 5 * 60_000) return { key: 'delayed', label: 'Delayed', ageMs };
  return { key: 'stale', label: 'Stale', ageMs };
}

export function formatUploadAge(lastSync, nowMs = Date.now()) {
  const status = getUploadStatus(lastSync, nowMs);
  if (status.ageMs === null) return 'Never';
  if (status.ageMs < 60_000) return `${Math.max(1, Math.round(status.ageMs / 1000))}s ago`;
  if (status.ageMs < 60 * 60_000) return `${Math.round(status.ageMs / 60_000)}m ago`;
  if (status.ageMs < 24 * 60 * 60_000) return `${Math.round(status.ageMs / 3_600_000)}h ago`;
  return `${Math.round(status.ageMs / 86_400_000)}d ago`;
}
