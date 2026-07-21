import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.js';
import { devices, readings, events } from './src/db/schema.js';
import { eq, or } from 'drizzle-orm';
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
