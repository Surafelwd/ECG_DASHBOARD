import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.js';
import { devices, readings, events, telemetrySessions } from './src/db/schema.js';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';
import { parseV1Csv, getUploadStatus, MAX_BATCH_SIZE, parseBatteryMillivolts } from './src/lib/telemetry-contract.mjs';
import { payloadDigest, sessionIdForPayload } from './src/lib/ingest-contract.mjs';
import 'dotenv/config';

type NormalizedReading = {
  deviceUptimeMs: number | null;
  timestampMs: number;
  accelXMg: number;
  accelYMg: number;
  accelZMg: number;
  ecgCh1Count: number;
  ecgCh2Count: number;
};

function requireFinite(value: unknown, index: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Reading ${index}: ${field} must be a finite number`);
  }
  return value;
}

function parseLegacyJson(body: any, receivedAtMs: number) {
  const input = Array.isArray(body?.readings)
    ? body.readings
    : body?.readings && typeof body.readings === 'object'
      ? [body.readings]
      : [];
  if (input.length === 0) throw new Error('Expected non-empty readings data');
  if (input.length > MAX_BATCH_SIZE) throw new Error(`Batch exceeds ${MAX_BATCH_SIZE} readings`);

  const normalized: NormalizedReading[] = input.map((reading: any, index: number) => ({
    deviceUptimeMs: null,
    timestampMs: requireFinite(reading.timestamp, index, 'timestamp'),
    accelXMg: requireFinite(reading.accel_x, index, 'accel_x'),
    accelYMg: requireFinite(reading.accel_y, index, 'accel_y'),
    accelZMg: requireFinite(reading.accel_z, index, 'accel_z'),
    ecgCh1Count: requireFinite(reading.ecg_ch1, index, 'ecg_ch1'),
    ecgCh2Count: requireFinite(reading.ecg_ch2, index, 'ecg_ch2'),
  }));
  const start = Math.min(...normalized.map((reading) => reading.timestampMs));
  const end = Math.max(...normalized.map((reading) => reading.timestampMs));

  return {
    deviceId: body.device_id || body.api_key || body.readings?.device_id || '',
    readings: normalized,
    durationMs: end - start,
    deviceUptimeStartMs: 0,
    deviceUptimeEndMs: 0,
    receivedAtMs,
  };
}

type DeviceTotals = { sessionCount: number; totalSamples: number };

function mapDevice(device: typeof devices.$inferSelect, totals: DeviceTotals = { sessionCount: 0, totalSamples: 0 }) {
  const lastUploadAt = device.last_sync ? new Date(device.last_sync).toISOString() : null;
  const uploadStatus = getUploadStatus(lastUploadAt);
  return {
    id: device.id,
    serialNumber: device.serial_number || device.id,
    ownerName: device.owner_name || '',
    lastUploadAt,
    uploadStatus: uploadStatus.label,
    uploadStatusKey: uploadStatus.key,
    sessionCount: totals.sessionCount,
    totalSamples: totals.totalSamples,
    batteryVoltageMv: device.last_battery_voltage_mv ?? null,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '5mb' }));
  app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }));

  app.post('/api/ingest', async (req, res) => {
    const receivedAt = new Date();
    try {
      const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      const parsed = typeof req.body === 'string'
        ? parseV1Csv(req.body, receivedAt.getTime())
        : parseLegacyJson(req.body, receivedAt.getTime());
      const batteryVoltageMv = parseBatteryMillivolts(req.get('x-battery-millivolts'));

      if (!parsed.deviceId) {
        return res.status(401).json({ error: 'Unauthorized: Missing device_id or api_key' });
      }

      const [device] = await db
        .select({ id: devices.id, is_retired: devices.is_retired })
        .from(devices)
        .where(or(eq(devices.api_key, parsed.deviceId), eq(devices.id, parsed.deviceId)))
        .limit(1);

      if (!device) return res.status(401).json({ error: 'Unauthorized: Invalid device key or id' });
      if (device.is_retired) return res.status(403).json({ error: 'Forbidden: Device is retired' });

      const sessionId = sessionIdForPayload(device.id, rawPayload);
      const hash = payloadDigest(device.id, rawPayload);
      const firstTimestamp = new Date(parsed.readings[0].timestampMs);
      const lastTimestamp = new Date(parsed.readings.at(-1)!.timestampMs);

      const result = await db.transaction(async (tx) => {
        const [createdSession] = await tx
          .insert(telemetrySessions)
          .values({
            id: sessionId,
            device_id: device.id,
            payload_hash: hash,
            received_at: receivedAt,
            estimated_start_time: firstTimestamp,
            estimated_end_time: lastTimestamp,
            device_uptime_start_ms: parsed.deviceUptimeStartMs,
            device_uptime_end_ms: parsed.deviceUptimeEndMs,
            sample_count: parsed.readings.length,
            battery_voltage_mv: batteryVoltageMv,
          })
          .onConflictDoNothing({ target: telemetrySessions.payload_hash })
          .returning({ id: telemetrySessions.id });

        if (!createdSession) return { duplicate: true };

        await tx.insert(readings).values(parsed.readings.map((reading) => ({
          device_id: device.id,
          session_id: sessionId,
          time: new Date(reading.timestampMs),
          device_uptime_ms: reading.deviceUptimeMs,
          accel_x: reading.accelXMg,
          accel_y: reading.accelYMg,
          accel_z: reading.accelZMg,
          ecg_ch1: reading.ecgCh1Count,
          ecg_ch2: reading.ecgCh2Count,
        })));

        await tx.update(devices)
          .set({
            last_sync: receivedAt,
            connectivity_status: 'online',
            last_battery_voltage_mv: batteryVoltageMv,
          })
          .where(eq(devices.id, device.id));

        return { duplicate: false };
      });

      return res.status(200).json({
        success: true,
        duplicate: result.duplicate,
        deviceId: device.id,
        sessionId,
        samplesReceived: parsed.readings.length,
      });
    } catch (error: any) {
      const message = error?.message || String(error);
      const isPayloadError = /CSV|Row|Reading|readings|Batch|Receipt time/i.test(message);
      if (isPayloadError) return res.status(400).json({ error: `Bad Request: ${message}` });
      console.error('Unexpected error in ingest function:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/devices', async (_req, res) => {
    try {
      const [allDevices, aggregateRows] = await Promise.all([
        db.select().from(devices).orderBy(desc(devices.last_sync)),
        db.select({
          deviceId: readings.device_id,
          sessionCount: sql<number>`count(distinct ${readings.session_id})`.as('session_count'),
          totalSamples: sql<number>`count(*)`.as('total_samples'),
        }).from(readings).groupBy(readings.device_id),
      ]);
      const totals = new Map(aggregateRows.map((row) => [row.deviceId, {
        sessionCount: Number(row.sessionCount),
        totalSamples: Number(row.totalSamples),
      }]));
      res.json(allDevices.map((device) => mapDevice(device, totals.get(device.id))));
    } catch (error) {
      console.error('Error fetching devices:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/devices/:id', async (req, res) => {
    try {
      const [device] = await db.select().from(devices).where(eq(devices.id, req.params.id)).limit(1);
      if (!device) return res.status(404).json({ error: 'Not found' });
      const [totals] = await db.select({
        sessionCount: sql<number>`count(distinct ${readings.session_id})`.as('session_count'),
        totalSamples: sql<number>`count(*)`.as('total_samples'),
      }).from(readings).where(eq(readings.device_id, device.id));
      res.json(mapDevice(device, {
        sessionCount: Number(totals?.sessionCount || 0),
        totalSamples: Number(totals?.totalSamples || 0),
      }));
    } catch (error) {
      console.error('Error fetching device:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/alarms', async (_req, res) => {
    try {
      const alarms = await db
        .select()
        .from(events)
        .where(and(eq(events.event_type, 'alarm'), ne(events.subtype, 'abnormal_signal_pattern')))
        .orderBy(desc(events.id))
        .limit(100);
      res.json(alarms);
    } catch (error) {
      console.error('Error fetching alarms:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/sessions/:deviceId', async (req, res) => {
    try {
      const rows = await db
        .select({
          sessionId: readings.session_id,
          startTime: sql<Date>`min(${readings.time})`.as('start_time'),
          endTime: sql<Date>`max(${readings.time})`.as('end_time'),
          receivedAt: sql<Date>`max(${telemetrySessions.received_at})`.as('received_at'),
          sampleCount: sql<number>`count(*)`.as('sample_count'),
          batteryVoltageMv: sql<number | null>`max(${telemetrySessions.battery_voltage_mv})`.as('battery_voltage_mv'),
        })
        .from(readings)
        .leftJoin(telemetrySessions, eq(readings.session_id, telemetrySessions.id))
        .where(eq(readings.device_id, req.params.deviceId))
        .groupBy(readings.session_id)
        .orderBy(desc(sql`max(${readings.time})`));

      res.json(rows.map((row) => {
        const sampleCount = Number(row.sampleCount);
        const startMs = new Date(row.startTime).getTime();
        const endMs = new Date(row.endTime).getTime();
        const spanMs = Math.max(0, endMs - startMs);
        const samplePeriodMs = sampleCount > 1 ? spanMs / (sampleCount - 1) : 0;
        return {
          sessionId: row.sessionId,
          startTime: row.startTime,
          endTime: row.endTime,
          receivedAt: row.receivedAt || row.endTime,
          sampleCount,
          durationMs: spanMs + samplePeriodMs,
          sampleRateHz: spanMs > 0 ? ((sampleCount - 1) * 1000) / spanMs : null,
          batteryVoltageMv: row.batteryVoltageMv === null ? null : Number(row.batteryVoltageMv),
          timeBasis: 'estimated-from-upload',
        };
      }));
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/telemetry/:deviceId', async (req, res) => {
    try {
      const requestedSession = typeof req.query.sessionId === 'string' ? req.query.sessionId : null;
      let sessionId = requestedSession;
      if (!sessionId) {
        const [latest] = await db
          .select({ sessionId: readings.session_id })
          .from(readings)
          .where(eq(readings.device_id, req.params.deviceId))
          .orderBy(desc(readings.time))
          .limit(1);
        sessionId = latest?.sessionId || null;
      }
      if (!sessionId) return res.json([]);

      const allRows = await db
        .select()
        .from(readings)
        .where(and(eq(readings.device_id, req.params.deviceId), eq(readings.session_id, sessionId)))
        .orderBy(readings.time);

      const targetPoints = 5000;
      const factor = Math.max(1, Math.ceil(allRows.length / targetPoints));
      res.json(factor === 1 ? allRows : allRows.filter((_, index) => index % factor === 0));
    } catch (error) {
      console.error('Error fetching telemetry:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
