# ECG telemetry dashboard

This service receives stored V1 Li-Po board recordings, writes them to
PostgreSQL, and displays the ECG and motion samples that the firmware actually
sends.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies with `npm install`.
2. Copy `.env.example` to a private `.env` and set `DATABASE_URL` to a test
   PostgreSQL database.
3. Apply the additive schema update with `npx drizzle-kit push`.
4. Run the app:
   `npm run dev`

## Register the V1 STM32 board (one-time database operation)

The firmware sends `device_id,STM32-<UID>` as the first CSV line. Ingest accepts
that value only when it matches a registered device's `id` or `api_key`.
Dashboard demo entries and a matching `serial_number` alone do not register it.

1. Rotate the database password previously exposed in `.env.example`, then
   update `DATABASE_URL` in the hosting environment and any private local `.env`.
   Replacing the example does **not** revoke the old credential or remove it
   from Git history. Do not reuse the exposed password.
2. Install the existing dependencies (`npm install --legacy-peer-deps` if needed).
3. In the repository root, with `DATABASE_URL` pointing to the **same database
   used by the deployed server**, run:

   ```sh
   npm run register:device -- STM32-0049002D5033500A20353741
   ```

   This can run locally with an authorized database connection or from a hosting
   shell that already has the correct environment. Do not put credentials in
   this command, screenshots, or Git.

The command creates one device row with the firmware UID as `id` and
`serial_number`, plus a separate random API key. It does not update or delete
existing devices, readings, or events. Re-running against an already compatible
registration reports `already_registered` without changing it. Retired devices,
ambiguous matches, and serial-only matches are refused for manual review.
It does not create database tables; the server's schema must already exist.

This script never runs automatically on startup, build, or deployment. **Pushing
the code does not register the board.** Registration in the correct database is
the step needed before retrying the hardware upload. Ingest and firmware are
unchanged; no server redeployment is required solely for the new database row.

After registration, retry the board and check for HTTP `200` and increasing
`uploads_ok`, then verify that the new recording appears on the dashboard.
Successful registration alone does not validate end-to-end telemetry.

Security limitation: the existing ingest endpoint accepts a public hardware ID
as identification. It is not secret authentication; this change preserves that
behavior rather than introducing a new authentication scheme.

Run `npm test` for registration unit tests. They substitute only the database
connection and never connect to the live database. They cover creation, repeat
registration, legacy API-key matches, retired/conflicting registrations, and
invalid input; live PostgreSQL and hardware verification remain separate steps.

## V1 telemetry shown by the dashboard

The production interface displays only measurements and state supported by the
current V1 Li-Po firmware:

- The primary waveform is ADS1292R Channel 2, the RA/LA differential input.
  Raw signed 24-bit codes remain in PostgreSQL and are converted for display
  using the current 2.42 V reference and gain-6 configuration.
- Channel 1 is configured as an internal-short noise/offset reference. It is
  available in a collapsed diagnostic panel and is not presented as a second
  ECG lead.
- LIS3DH X/Y/Z values are displayed in mg because the firmware uses +/-2 g
  high-resolution mode. Motion updates at 50 Hz and is repeated across the
  250 Hz ECG rows.
- Each normal V1 recording contains 2,500 samples over approximately 10
  seconds. The dashboard shows the actual count, measured sample rate, and
  recording duration.
- Firmware timestamps are STM32 uptime values. Wall-clock capture times are
  estimated by aligning the last sample to server receipt, while waveform axes
  use accurate elapsed session time.
- Device status means recent, delayed, or stale upload activity. It does not
  claim that the board maintains a continuous server connection.

Battery percentage, radio signal, GPS location, firmware version, clinical
analysis, and remote device commands are intentionally absent because the
current upload does not contain them. V1 can later report battery voltage by
querying the A7670G with `AT+CBC` while the modem rail is on and adding that
value to versioned session metadata. Voltage should be shown before attempting
an estimated Li-Po percentage.

The dashboard currently has no user login or access-control layer. Protect the
deployed service before using it for personal or clinical data.

## Ingest reliability and schema update

Ingest validates the exact V1 CSV header, six finite numeric columns, ordered
32-bit uptime values, and a maximum of 5,000 readings. A SHA-256-derived session
identity makes an identical firmware retry idempotent: the server returns HTTP
200 with `duplicate: true` and does not insert the same recording again.

Session metadata, readings, and device upload time are written in one database
transaction. The schema adds `telemetry_sessions` and
`readings.device_uptime_ms`; the existing Render build command runs
`drizzle-kit push` before building, so the deployment database must be the same
Neon database identified by `DATABASE_URL`.

Before deployment, run:

```sh
npm test
npm run lint
npm run build
```

After deployment, post one saved firmware CSV twice. Both requests must return
HTTP 200, the second must report `duplicate: true`, and only one new recording
with 2,500 readings should appear.
