import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.js';
import { devices, readings, events } from './src/db/schema.js';
import { eq, or, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import 'dotenv/config';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ingest API
  app.post('/api/ingest', async (req, res) => {
    try {
      const body = req.body;
      let readingsArray = [];
      if (Array.isArray(body.readings)) {
        readingsArray = body.readings;
      } else if (body.readings && typeof body.readings === 'object') {
        readingsArray = [body.readings];
      }

      const deviceKey = body.device_id || body.api_key || (body.readings && body.readings.device_id);
      
      if (!deviceKey) {
        return res.status(401).json({ error: 'Unauthorized: Missing device_id or api_key' });
      }

      // Look up device
      const [device] = await db
        .select({ id: devices.id, is_retired: devices.is_retired })
        .from(devices)
        .where(
          or(
            eq(devices.api_key, deviceKey),
            eq(devices.id, deviceKey)
          )
        )
        .limit(1);

      if (!device) {
        return res.status(401).json({ error: 'Unauthorized: Invalid device key or id' });
      }

      if (device.is_retired) {
        return res.status(403).json({ error: 'Forbidden: Device is retired' });
      }

      if (readingsArray.length === 0) {
        return res.status(400).json({ error: 'Bad Request: Expected non-empty "readings" data' });
      }

      const MAX_BATCH_SIZE = 5000;
      if (readingsArray.length > MAX_BATCH_SIZE) {
        return res.status(413).json({ error: `Payload Too Large: Max ${MAX_BATCH_SIZE} readings per request` });
      }

      for (let i = 0; i < readingsArray.length; i++) {
        const r = readingsArray[i];
        if (
          typeof r.timestamp !== 'number' ||
          typeof r.accel_x !== 'number' ||
          typeof r.accel_y !== 'number' ||
          typeof r.accel_z !== 'number' ||
          typeof r.ecg_ch1 !== 'number' ||
          typeof r.ecg_ch2 !== 'number'
        ) {
          return res.status(400).json({ error: `Bad Request: Malformed reading at index ${i}` });
        }
      }

      const sessionId = crypto.randomUUID();
      const rowsToInsert = readingsArray.map((r: any) => ({
        device_id: device.id,
        session_id: sessionId,
        time: new Date(r.timestamp),
        accel_x: r.accel_x,
        accel_y: r.accel_y,
        accel_z: r.accel_z,
        ecg_ch1: r.ecg_ch1,
        ecg_ch2: r.ecg_ch2,
      }));

      await db.insert(readings).values(rowsToInsert);

      await db.update(devices)
        .set({
          last_sync: new Date(),
          connectivity_status: 'online',
        })
        .where(eq(devices.id, device.id));

      await db.insert(events).values({
        device_id: device.id,
        event_type: 'connectivity',
        subtype: 'reconnected',
        status: 'resolved',
        payload: { samples_received: readingsArray.length },
      });

      let sumMagnitude = 0;
      for (const r of readingsArray) {
        sumMagnitude += Math.sqrt(r.accel_x ** 2 + r.accel_y ** 2 + r.accel_z ** 2);
      }
      const avgMagnitude = sumMagnitude / readingsArray.length;
      
      if (avgMagnitude > 5.0) {
        await db.insert(events).values({
          device_id: device.id,
          event_type: 'alarm',
          subtype: 'abnormal_signal_pattern',
          severity: 'warning',
          status: 'unacknowledged',
          payload: { avg_magnitude: avgMagnitude, description: 'High average acceleration detected.' }
        });
      }

      return res.status(200).json({
        success: true,
        deviceId: device.id,
        sessionId,
        samplesReceived: readingsArray.length,
      });
    } catch (err) {
      console.error('Unexpected error in ingest function:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET endpoints for the dashboard
  app.get('/api/devices', async (req, res) => {
    try {
      const allDevices = await db.select().from(devices);
      // Map snake_case DB fields to camelCase for frontend
      const mapped = allDevices.map(d => ({
        id: d.id,
        serialNumber: d.serial_number || d.id,
        ownerName: d.owner_name || '',
        connectivityStatus: d.connectivity_status === 'online' ? 'Online' : 'Offline',
        batteryLevel: d.battery_level ?? 100,
        signalStrength: d.connectivity_status === 'online' ? 3 : 0,
        firmwareVersion: 'v1.0.0',
        firmwareUpdateAvailable: false,
        lastSync: d.last_sync ? new Date(d.last_sync).toLocaleString() : 'Never',
      }));
      res.json(mapped);
    } catch (err) {
      console.error('Error fetching devices:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/devices/:id', async (req, res) => {
    try {
      const [d] = await db.select().from(devices).where(eq(devices.id, req.params.id)).limit(1);
      if (!d) return res.status(404).json({ error: 'Not found' });
      res.json({
        id: d.id,
        serialNumber: d.serial_number || d.id,
        ownerName: d.owner_name || '',
        connectivityStatus: d.connectivity_status === 'online' ? 'Online' : 'Offline',
        batteryLevel: d.battery_level ?? 100,
        signalStrength: d.connectivity_status === 'online' ? 3 : 0,
        firmwareVersion: 'v1.0.0',
        firmwareUpdateAvailable: false,
        lastSync: d.last_sync ? new Date(d.last_sync).toLocaleString() : 'Never',
      });
    } catch (err) {
      console.error('Error fetching device:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/alarms', async (req, res) => {
    try {
      const allAlarms = await db.select().from(events).orderBy(desc(events.id)).limit(100);
      res.json(allAlarms);
    } catch (err) {
      console.error('Error fetching alarms:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET /api/sessions/:deviceId  — list all sessions for a device
  app.get('/api/sessions/:deviceId', async (req, res) => {
    try {
      // Group readings by session_id, return metadata for each
      const rows = await db
        .select({
          sessionId: readings.session_id,
          startTime: sql<Date>`min(${readings.time})`.as('start_time'),
          endTime:   sql<Date>`max(${readings.time})`.as('end_time'),
          sampleCount: sql<number>`count(*)`.as('sample_count'),
        })
        .from(readings)
        .where(eq(readings.device_id, req.params.deviceId))
        .groupBy(readings.session_id)
        .orderBy(desc(sql`max(${readings.time})`));

      const sessions = rows.map(r => ({
        sessionId:   r.sessionId,
        startTime:   r.startTime,
        endTime:     r.endTime,
        sampleCount: Number(r.sampleCount),
        durationMs:  r.endTime && r.startTime
          ? new Date(r.endTime).getTime() - new Date(r.startTime).getTime()
          : 0,
      }));

      res.json(sessions);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET /api/telemetry/:deviceId?sessionId=xxx  — adaptive downsampling
  app.get('/api/telemetry/:deviceId', async (req, res) => {
    try {
      const TARGET_POINTS = 5000;
      const { sessionId } = req.query;

      // 1. Fetch the raw rows for this session (or all rows if no session specified)
      const query = db.select()
        .from(readings)
        .where(
          sessionId
            ? sql`${readings.device_id} = ${req.params.deviceId} AND ${readings.session_id} = ${sessionId}`
            : eq(readings.device_id, req.params.deviceId)
        )
        .orderBy(readings.time);

      const allRows = await query;
      const total = allRows.length;

      if (total === 0) return res.json([]);

      // 2. Adaptive downsampling: keep every Nth point so we never return > TARGET_POINTS
      const factor = Math.max(1, Math.floor(total / TARGET_POINTS));
      const downsampled = factor === 1
        ? allRows
        : allRows.filter((_, i) => i % factor === 0);

      res.json(downsampled);
    } catch (err) {
      console.error('Error fetching telemetry:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
