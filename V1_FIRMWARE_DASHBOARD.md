# V1 Firmware and Dashboard Requirements

This describes the functionality needed for reliable communication between the
V1 Li-Po ECG board and the hosted dashboard.

## Connection

- Dashboard: `https://ecg-dashboard-1h8s.onrender.com`
- Upload: `POST /api/ingest`
- Content type: `text/csv`
- Database: Neon PostgreSQL through the existing `DATABASE_URL`
- Firmware branch: `v1-lipo-modem-gate`
- Device: `STM32-0049002D5033500A20353741`

The device must already exist in the Neon `devices` table and must not be
retired. The schema requires a unique random API key for its database row, but
the current firmware authenticates using its pre-registered STM32 ID. Enforcing
an API key would require a matching firmware change.

## Upload Format

A normal upload contains 2,500 readings recorded over approximately 10 seconds
at 250 samples per second:

```csv
device_id,STM32-0049002D5033500A20353741
timestamp,accel_x,accel_y,accel_z,ecg_ch1,ecg_ch2
123456,10,-15,1012,115,28473
123460,11,-14,1011,117,28501
```

The server must support:

- The exact device and column-header format above.
- Six finite numeric values in every reading.
- Strictly increasing device-uptime timestamps.
- At least 2,500 readings in one request.
- Complete validation before anything is stored.
- One database transaction per recording.
- Duplicate protection when the modem retries the same file.
- HTTP 200 only after a valid recording is stored successfully.
- HTTP 401 for unknown devices and HTTP 403 for retired devices.

An identical retry should return HTTP 200 without inserting another session or
another copy of its readings. A stable digest of the complete payload can be
used to identify duplicates.

## Data Interpretation

- `timestamp` is STM32 uptime in milliseconds, not Unix or RTC time.
- Capture time may be estimated from the server receipt time and must remain
  identified as an estimate.
- `ecg_ch2` is the RA/LA differential ECG channel.
- `ecg_ch1` is internally shorted and is diagnostic only.
- ECG values are raw signed ADS1292R codes and should stay raw in storage.
- ECG conversion is `raw * (2.42 / (6 * 8388607)) * 1000` mV.
- LIS3DH acceleration is in `mg`; stationary magnitude is near 1,000 mg.

The firmware may include an optional header:

```text
X-Battery-Millivolts: 3749
```

Battery values must be integers from 2500 through 5000 mV. Missing or invalid
battery metadata must not reject an ECG upload. Battery percentage should not
be inferred from this voltage measurement. The current `AT+CBC` query still
needs hardware diagnosis, so uploads will often have no battery value.

## Required Dashboard Functionality

- Register and retire physical devices.
- Receive and authorize V1 CSV uploads.
- Store complete, separate recording sessions.
- Prevent duplicates caused by modem retries.
- List registered devices and their last successful upload.
- Retrieve the stored sessions for a selected device.
- Retrieve ECG and motion readings for a selected session.
- Use the correct ECG, motion, and timing meanings described above.
- Store optional battery voltage when the firmware supplies it.
- Handle unavailable hardware data without inventing values.
- Preserve the existing database connection and stored Neon data.

## Validation

Confirm that a valid 2,500-reading upload returns HTTP 200, malformed uploads are
stored neither wholly nor partially, and posting the same file twice creates
only one session. The session APIs must return the stored values accurately,
and missing battery metadata must not affect ingestion.

The current known-good hardware run completed 21 recordings and 21 HTTP 200
uploads with 52,500 samples and no ADS, SD, HTTP, or TLS failures.
