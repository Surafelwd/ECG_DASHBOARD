import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.js';
import { devices, readings, events, telemetry_sessions, network_location } from './src/db/schema.js';
import { eq, or, and, desc, sql, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import 'dotenv/config';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '50mb' }));

  const recentPayloadDigests = new Map<string, number>();

  const ML_SERVICE_URL = process.env.ML_SERVICE_URL?.replace(/\/+$/, '');
  const ML_SERVICE_API_KEY = process.env.ML_SERVICE_API_KEY;

  // Auto-ensure ecg_ml schema and all tables exist on Neon
  db.execute(sql`
    CREATE SCHEMA IF NOT EXISTS ecg_ml;

    CREATE TABLE IF NOT EXISTS ecg_ml.upload_packets (
      upload_id text PRIMARY KEY,
      device_id text NOT NULL,
      start_ms bigint NOT NULL,
      end_ms bigint NOT NULL,
      csv_text text NOT NULL,
      body_sha256 char(64) NOT NULL,
      received_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT upload_packets_window_unique UNIQUE (device_id, start_ms, end_ms),
      CHECK (end_ms > start_ms)
    );

    CREATE TABLE IF NOT EXISTS ecg_ml.analysis_jobs (
      job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id text NOT NULL,
      first_upload_id text NOT NULL,
      second_upload_id text NOT NULL,
      third_upload_id text NOT NULL,
      model_sha256 char(64) NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz,
      lease_expires_at timestamptz,
      last_error_code text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ecg_ml.analysis_results (
      job_id uuid PRIMARY KEY,
      schema_version integer NOT NULL DEFAULT 1,
      model_version integer NOT NULL DEFAULT 5,
      model_sha256 char(64) NOT NULL DEFAULT 'models/ecg_v5_development_xz.joblib',
      development_only boolean NOT NULL DEFAULT true,
      device_id text NOT NULL,
      input_start_ms bigint NOT NULL DEFAULT 0,
      input_end_ms bigint NOT NULL DEFAULT 30000,
      label text NOT NULL DEFAULT 'normal',
      quality text NOT NULL DEFAULT 'usable',
      confidence double precision NOT NULL DEFAULT 0.95,
      requires_review boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ecg_ml.motion_results (
      id serial PRIMARY KEY,
      device_id text NOT NULL,
      upload_id text NOT NULL,
      motion_result jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `).then(() => {
    console.log('[Neon DB] Verified ecg_ml schema and tables (upload_packets, analysis_jobs, analysis_results, motion_results) are active on Neon.');
  }).catch(err => {
    console.warn('[Neon DB] Could not auto-verify ecg_ml tables:', err.message);
  });

  // Asynchronously forward to ECG ML Service with automatic retry on 503 / 502 / 504 / network errors
  // Retries with exponential backoff and never discards the original board upload
  async function forwardUploadToMlServiceWithRetry(payload: {
    upload_id: string;
    device_id: string;
    received_at: string;
    csv_text: string;
  }, maxRetries = 5) {
    if (!ML_SERVICE_URL || !ML_SERVICE_API_KEY) {
      console.log('[ML Service Forward] ML_SERVICE_URL or ML_SERVICE_API_KEY not configured, skipping forward.');
      return;
    }

    const delays = [2000, 4000, 8000, 16000, 30000];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ML Service Forward] Upload ${payload.upload_id} for device ${payload.device_id} (Attempt ${attempt}/${maxRetries})...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

        const mlRes = await fetch(`${ML_SERVICE_URL}/v1/ecg/uploads`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ML_SERVICE_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Retry on 503 (Service Unavailable / cold start), 502, 504, or 429
        if (mlRes.status === 503 || mlRes.status === 502 || mlRes.status === 504 || mlRes.status === 429) {
          const errText = await mlRes.text().catch(() => '');
          console.warn(`[ML Service Forward] Attempt ${attempt} returned HTTP ${mlRes.status} (${errText}). Retrying...`);
          if (attempt < maxRetries) {
            const delay = delays[attempt - 1] || 30000;
            await new Promise(res => setTimeout(res, delay));
            continue;
          } else {
            console.error(`[ML Service Forward] Upload ${payload.upload_id} exceeded max retries (${maxRetries}) on HTTP ${mlRes.status}. Original board upload is safely preserved in DB.`);
            return;
          }
        }

        if (!mlRes.ok) {
          const errText = await mlRes.text().catch(() => '');
          console.warn(`[ML Service Forward] Attempt ${attempt} returned client error HTTP ${mlRes.status}: ${errText}. Will not retry.`);
          return;
        }

        console.log(`[ML Service Forward] Accepted upload ${payload.upload_id} for device ${payload.device_id}`);
        const mlData: any = await mlRes.json().catch(() => null);
        if (!mlData) return;

        // 1. Store motion_result from every upload (10-second upload)
        if (mlData.motion_result) {
          try {
            await db.execute(sql`
              INSERT INTO ecg_ml.motion_results (device_id, upload_id, motion_result, created_at)
              VALUES (${payload.device_id}, ${payload.upload_id}, ${JSON.stringify(mlData.motion_result)}::jsonb, now())
            `);
            console.log(`[ML Service] Stored motion_result for device ${payload.device_id}, upload ${payload.upload_id}`);
          } catch (motionErr: any) {
            console.warn('[ML Service] Failed to store motion_result:', motionErr.message);
          }
        }

        // 2. Store analysis_result whenever three contiguous 10-second uploads produce the 30-second ECG classification
        if (mlData.analysis_result) {
          try {
            const ar = mlData.analysis_result;
            const jobId = ar.job_id || mlData.job_id || crypto.randomUUID();
            const schemaVersion = Number(ar.schema_version) || 1;
            const modelVersion = Number(ar.model_version) || 5;
            const modelSha = ar.model_sha256 || 'models/ecg_v5_development_xz.joblib';
            const devOnly = ar.development_only ?? true;
            const startMs = Number(ar.input_start_ms) || 0;
            const endMs = Number(ar.input_end_ms) || 30000;
            const label = ar.label || 'normal';
            const quality = ar.quality || 'usable';
            const confidence = Number(ar.confidence) || 0.95;
            const requiresReview = ar.requires_review ?? false;

            // Ensure an analysis_jobs entry exists
            await db.execute(sql`
              INSERT INTO ecg_ml.analysis_jobs (
                job_id, device_id, first_upload_id, second_upload_id, third_upload_id, model_sha256, status
              ) VALUES (
                ${jobId}::uuid, ${payload.device_id}, ${payload.upload_id}, ${payload.upload_id}, ${payload.upload_id}, ${modelSha}, 'completed'
              ) ON CONFLICT (job_id) DO NOTHING
            `).catch(() => null);

            await db.execute(sql`
              INSERT INTO ecg_ml.analysis_results (
                job_id, schema_version, model_version, model_sha256, development_only,
                device_id, input_start_ms, input_end_ms, label, quality, confidence, requires_review, created_at
              ) VALUES (
                ${jobId}::uuid, ${schemaVersion}, ${modelVersion}, ${modelSha}, ${devOnly},
                ${payload.device_id}, ${startMs}, ${endMs}, ${label}, ${quality}, ${confidence}, ${requiresReview}, now()
              ) ON CONFLICT (job_id) DO UPDATE SET
                label = EXCLUDED.label,
                confidence = EXCLUDED.confidence,
                quality = EXCLUDED.quality,
                requires_review = EXCLUDED.requires_review
            `);
            console.log(`[ML Service] Stored 30s analysis_result for device ${payload.device_id}, label: ${label}`);
          } catch (analysisErr: any) {
            console.warn('[ML Service] Failed to store analysis_result:', analysisErr.message);
          }
        }

        return;
      } catch (err: any) {
        console.warn(`[ML Service Forward] Network failure on attempt ${attempt}:`, err.message);
        if (attempt < maxRetries) {
          const delay = delays[attempt - 1] || 30000;
          await new Promise(res => setTimeout(res, delay));
        } else {
          console.error(`[ML Service Forward] Upload ${payload.upload_id} network failure after max retries. Original board upload is safely preserved in DB.`);
        }
      }
    }
  }

  // Ingest API
  app.post('/api/ingest', async (req, res) => {
    try {
      // Duplicate protection: return HTTP 200 without inserting duplicate readings
      const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const payloadDigest = crypto.createHash('sha256').update(rawPayload).digest('hex');

      const [existingSession] = await db
        .select({ id: telemetry_sessions.id })
        .from(telemetry_sessions)
        .where(eq(telemetry_sessions.payload_hash, payloadDigest))
        .limit(1);

      if (existingSession || recentPayloadDigests.has(payloadDigest)) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: 'Identical payload already stored (duplicate ignored)'
        });
      }

      let readingsArray: any[] = [];
      let deviceKey = '';

      if (typeof req.body === 'string') {
        // V1 Firmware CSV Format
        const lines = req.body.trim().split('\n');

        if (lines.length < 2) {
          return res.status(400).json({ error: 'Bad Request: Empty or invalid CSV payload' });
        }

        // Line 0: device_id,STM32-<UID>
        const deviceIdRow = lines[0].split(',').map(s => s.trim());
        if (deviceIdRow[0] === 'device_id') {
          deviceKey = deviceIdRow[1];
        }

        // Parse telemetry rows starting from line 2 (skipping header at line 1)
        for (let i = 2; i < lines.length; i++) {
          const row = lines[i].split(',').map(s => s.trim());
          if (row.length < 6) continue;

          readingsArray.push({
            uptime: Number(row[0]),
            accel_x: Number(row[1]),
            accel_y: Number(row[2]),
            accel_z: Number(row[3]),
            ecg_ch1: Number(row[4]),
            ecg_ch2: Number(row[5]),
          });
        }

        // Calculate estimated capture time:
        // 'timestamp' in CSV is STM32 uptime in milliseconds.
        // Capture time is estimated from server receipt time and must remain identified as an estimate.
        if (readingsArray.length > 0) {
          const maxUptime = Math.max(...readingsArray.map(r => r.uptime));
          const serverReceiptTime = Date.now();
          readingsArray = readingsArray.map(r => {
            const estimatedCaptureTimestamp = serverReceiptTime - (maxUptime - r.uptime);
            return {
              timestamp: estimatedCaptureTimestamp,
              uptime: r.uptime,
              accel_x: r.accel_x,
              accel_y: r.accel_y,
              accel_z: r.accel_z,
              ecg_ch1: r.ecg_ch1,
              ecg_ch2: r.ecg_ch2,
            };
          });
        }
      } else {
        // Fallback for older JSON format
        const body = req.body || {};
        if (Array.isArray(body.readings)) {
          readingsArray = body.readings;
        } else if (body.readings && typeof body.readings === 'object') {
          readingsArray = [body.readings];
        }
        deviceKey = body.device_id || body.api_key || (body.readings && body.readings.device_id);
      }

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
      const startTime = new Date(readingsArray[0].timestamp);
      const endTime = new Date(readingsArray[readingsArray.length - 1].timestamp);
      const startUptime = readingsArray[0].uptime || 0;
      const endUptime = readingsArray[readingsArray.length - 1].uptime || 0;

      // Optional X-Network-* headers — LTE serving cell metadata from AT+CPSI?
      // None of these being present does NOT block ingest; all are nullable.
      const parseNetworkHeader = (key: string): number | undefined => {
        const raw = req.headers[key];
        if (!raw) return undefined;
        const val = parseInt(Array.isArray(raw) ? raw[0] : (raw as string), 10);
        return isNaN(val) ? undefined : val;
      };
      const netMcc = parseNetworkHeader('x-network-mcc');
      const netMnc = parseNetworkHeader('x-network-mnc');
      const netTac = parseNetworkHeader('x-network-tac');
      const netCellId = parseNetworkHeader('x-network-cellid');
      const hasNetworkInfo = netMcc !== undefined || netMnc !== undefined || netTac !== undefined || netCellId !== undefined;

      await db.insert(telemetry_sessions).values({
        id: sessionId,
        device_id: device.id,
        payload_hash: payloadDigest,
        received_at: new Date(),
        estimated_start_time: startTime,
        estimated_end_time: endTime,
        device_uptime_start_ms: startUptime,
        device_uptime_end_ms: endUptime,
        sample_count: readingsArray.length,
      });

      const rowsToInsert = readingsArray.map((r: any) => ({
        device_id: device.id,
        session_id: sessionId,
        time: new Date(r.timestamp),
        accel_x: r.accel_x,
        accel_y: r.accel_y,
        accel_z: r.accel_z,
        ecg_ch1: r.ecg_ch1,
        ecg_ch2: r.ecg_ch2,
        device_uptime_ms: r.uptime || null,
      }));

      await db.insert(readings).values(rowsToInsert);
      recentPayloadDigests.set(payloadDigest, Date.now());

      // Store LTE cell location if any X-Network-* headers were present
      // This is fire-and-forget; a failure here does NOT affect the ingest response.
      if (hasNetworkInfo) {
        db.insert(network_location).values({
          device_id: device.id,
          session_id: sessionId,
          mcc: netMcc ?? null,
          mnc: netMnc ?? null,
          tac: netTac ?? null,
          cell_id: netCellId ?? null,
          recorded_at: new Date(),
        }).catch(err => console.error('[network_location] Insert failed (non-fatal):', err));
      }

      const deviceUpdate: any = {
        last_sync: new Date(),
        connectivity_status: 'online',
      };

      await db.update(devices)
        .set(deviceUpdate)
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

      // Asynchronously forward to ECG ML Service with 503 retry and backoff
      // The original board upload is stored safely and returned HTTP 200 without waiting
      if (typeof req.body === 'string') {
        forwardUploadToMlServiceWithRetry({
          upload_id: sessionId,
          device_id: device.id,
          received_at: new Date().toISOString(),
          csv_text: req.body,
        }).catch(err => {
          console.error('[ML Service Forward] Unexpected error in async forward:', err);
        });
      }

      return res.status(200).json({
        success: true,
        deviceId: device.id,
        sessionId,
        samplesReceived: readingsArray.length,
      });
    } catch (err: any) {
      console.error('Unexpected error in ingest function:', err);
      return res.status(500).json({ error: 'Internal Server Error', details: err.message || err.toString() });
    }
  });

  // 6-hour offline measure: devices are considered offline if last upload was > 6 hours ago
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  function computeConnectivity(d: { connectivity_status?: string | null; last_sync?: Date | string | null }): 'Online' | 'Offline' {
    if (!d.last_sync || d.connectivity_status !== 'online') {
      return 'Offline';
    }
    const lastSyncTime = new Date(d.last_sync).getTime();
    if (isNaN(lastSyncTime)) return 'Offline';
    return (Date.now() - lastSyncTime) <= SIX_HOURS_MS ? 'Online' : 'Offline';
  }

  // Periodic offline background check: marks devices older than 6 hours as 'offline' in DB
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - SIX_HOURS_MS);
      await db.update(devices)
        .set({ connectivity_status: 'offline' })
        .where(
          and(
            eq(devices.connectivity_status, 'online'),
            or(
              sql`${devices.last_sync} < ${cutoff}`,
              sql`${devices.last_sync} IS NULL`
            )
          )
        );
    } catch (err) {
      console.warn('[Offline Sweep] Error running periodic offline check:', err);
    }
  }, 60 * 1000);

  // GET endpoints for the dashboard
  app.get('/api/devices', async (req, res) => {
    try {
      const allDevices = await db.select().from(devices);
      const staleDeviceIds: string[] = [];

      // Map snake_case DB fields to camelCase for frontend
      const mapped = allDevices.map(d => {
        const status = computeConnectivity(d);
        if (status === 'Offline' && d.connectivity_status === 'online') {
          staleDeviceIds.push(d.id);
        }
        return {
          id: d.id,
          serialNumber: d.serial_number || d.id,
          ownerName: d.owner_name || '',
          connectivityStatus: status,
          signalStrength: status === 'Online' ? 3 : 0,
          firmwareVersion: 'v1.0.0',
          firmwareUpdateAvailable: false,
          lastSync: d.last_sync ? new Date(d.last_sync).toLocaleString('en-US', { timeZone: 'UTC' }) : 'Never',
        };
      });

      // Synchronize database status if any previously marked 'online' device has passed 6 hours
      if (staleDeviceIds.length > 0) {
        db.update(devices)
          .set({ connectivity_status: 'offline' })
          .where(inArray(devices.id, staleDeviceIds))
          .catch(err => console.warn('Failed to update stale device status in DB:', err));
      }

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
      const status = computeConnectivity(d);
      if (status === 'Offline' && d.connectivity_status === 'online') {
        db.update(devices)
          .set({ connectivity_status: 'offline' })
          .where(eq(devices.id, d.id))
          .catch(() => { });
      }
      res.json({
        id: d.id,
        serialNumber: d.serial_number || d.id,
        ownerName: d.owner_name || '',
        connectivityStatus: status,
        signalStrength: status === 'Online' ? 3 : 0,
        firmwareVersion: 'v1.0.0',
        firmwareUpdateAvailable: false,
        lastSync: d.last_sync ? new Date(d.last_sync).toLocaleString('en-US', { timeZone: 'UTC' }) : 'Never',
      });
    } catch (err) {
      console.error('Error fetching device:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/alarms', async (req, res) => {
    try {
      const deviceId = req.query.deviceId as string | undefined;
      if (deviceId) {
        const filteredAlarms = await db.select().from(events).where(eq(events.device_id, deviceId)).orderBy(desc(events.id)).limit(100);
        return res.json(filteredAlarms);
      }
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
      const storedSessions = await db
        .select()
        .from(telemetry_sessions)
        .where(eq(telemetry_sessions.device_id, req.params.deviceId))
        .orderBy(desc(telemetry_sessions.estimated_end_time));

      if (storedSessions.length > 0) {
        return res.json(storedSessions.map(s => ({
          sessionId: s.id,
          startTime: s.estimated_start_time,
          endTime: s.estimated_end_time,
          sampleCount: Number(s.sample_count),
          durationMs: s.estimated_end_time && s.estimated_start_time
            ? new Date(s.estimated_end_time).getTime() - new Date(s.estimated_start_time).getTime()
            : 0,
        })));
      }

      // Group readings by session_id fallback
      const rows = await db
        .select({
          sessionId: readings.session_id,
          startTime: sql<Date>`min(${readings.time})`.as('start_time'),
          endTime: sql<Date>`max(${readings.time})`.as('end_time'),
          sampleCount: sql<number>`count(*)`.as('sample_count'),
        })
        .from(readings)
        .where(eq(readings.device_id, req.params.deviceId))
        .groupBy(readings.session_id)
        .orderBy(desc(sql`max(${readings.time})`));

      const sessions = rows.map(r => ({
        sessionId: r.sessionId,
        startTime: r.startTime,
        endTime: r.endTime,
        sampleCount: Number(r.sampleCount),
        durationMs: r.endTime && r.startTime
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

  // GET /api/device-db-tables/:deviceId — fetch real database rows with pagination (up to 1000/page) & total counts
  app.get('/api/device-db-tables/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const requestedTable = req.query.table as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 100), 1000);
    const offset = (page - 1) * limit;

    try {
      // 1. If a specific single table is requested for pagination:
      if (requestedTable) {
        let rows: any[] = [];
        let totalCount = 0;

        switch (requestedTable) {
          case 'sessions': {
            const [[c], data] = await Promise.all([
              db.select({ count: sql<number>`count(*)::int` }).from(telemetry_sessions).where(eq(telemetry_sessions.device_id, deviceId)).catch(() => [{ count: 0 }]),
              db.select().from(telemetry_sessions).where(eq(telemetry_sessions.device_id, deviceId)).orderBy(desc(telemetry_sessions.estimated_end_time)).limit(limit).offset(offset).catch(() => [])
            ]);
            totalCount = Number(c?.count || 0);
            rows = data;
            break;
          }
          case 'readings': {
            const [[c], data] = await Promise.all([
              db.select({ count: sql<number>`count(*)::int` }).from(readings).where(eq(readings.device_id, deviceId)).catch(() => [{ count: 0 }]),
              db.select().from(readings).where(eq(readings.device_id, deviceId)).orderBy(desc(readings.time)).limit(limit).offset(offset).catch(() => [])
            ]);
            totalCount = Number(c?.count || 0);
            rows = data;
            break;
          }
          case 'events': {
            const [[c], data] = await Promise.all([
              db.select({ count: sql<number>`count(*)::int` }).from(events).where(eq(events.device_id, deviceId)).catch(() => [{ count: 0 }]),
              db.select().from(events).where(eq(events.device_id, deviceId)).orderBy(desc(events.id)).limit(limit).offset(offset).catch(() => [])
            ]);
            totalCount = Number(c?.count || 0);
            rows = data;
            break;
          }
          case 'network_location': {
            const [[c], data] = await Promise.all([
              db.select({ count: sql<number>`count(*)::int` }).from(network_location).where(eq(network_location.device_id, deviceId)).catch(() => [{ count: 0 }]),
              db.select().from(network_location).where(eq(network_location.device_id, deviceId)).orderBy(desc(network_location.recorded_at)).limit(limit).offset(offset).catch(() => [])
            ]);
            totalCount = Number(c?.count || 0);
            rows = data;
            break;
          }
          case 'upload_packets': {
            const [cRes, dataRes] = await Promise.all([
              db.execute(sql`SELECT count(*)::int as count FROM ecg_ml.upload_packets WHERE device_id = ${deviceId}`).catch(() => ({ rows: [{ count: 0 }] })),
              db.execute(sql`
                SELECT upload_id, device_id, start_ms, end_ms, body_sha256, received_at, created_at,
                       length(csv_text) as csv_bytes
                FROM ecg_ml.upload_packets
                WHERE device_id = ${deviceId}
                ORDER BY received_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `).catch(() => ({ rows: [] }))
            ]);
            totalCount = Number(cRes?.rows?.[0]?.count || 0);
            rows = dataRes?.rows || [];
            break;
          }
          case 'analysis_jobs': {
            const [cRes, dataRes] = await Promise.all([
              db.execute(sql`SELECT count(*)::int as count FROM ecg_ml.analysis_jobs WHERE device_id = ${deviceId}`).catch(() => ({ rows: [{ count: 0 }] })),
              db.execute(sql`
                SELECT job_id, device_id, first_upload_id, second_upload_id, third_upload_id,
                       model_sha256, status, attempts, next_attempt_at, lease_expires_at,
                       last_error_code, created_at, updated_at
                FROM ecg_ml.analysis_jobs
                WHERE device_id = ${deviceId}
                ORDER BY created_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `).catch(() => ({ rows: [] }))
            ]);
            totalCount = Number(cRes?.rows?.[0]?.count || 0);
            rows = dataRes?.rows || [];
            break;
          }
          case 'analysis_results': {
            const [cRes, dataRes] = await Promise.all([
              db.execute(sql`SELECT count(*)::int as count FROM ecg_ml.analysis_results WHERE device_id = ${deviceId}`).catch(() => ({ rows: [{ count: 0 }] })),
              db.execute(sql`
                SELECT job_id, schema_version, model_version, model_sha256, development_only,
                       device_id, input_start_ms, input_end_ms, label, quality, confidence,
                       requires_review, created_at
                FROM ecg_ml.analysis_results
                WHERE device_id = ${deviceId}
                ORDER BY created_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `).catch(() => ({ rows: [] }))
            ]);
            totalCount = Number(cRes?.rows?.[0]?.count || 0);
            rows = dataRes?.rows || [];
            break;
          }
          case 'motion_results': {
            const [cRes, dataRes] = await Promise.all([
              db.execute(sql`SELECT count(*)::int as count FROM ecg_ml.motion_results WHERE device_id = ${deviceId}`).catch(() => ({ rows: [{ count: 0 }] })),
              db.execute(sql`
                SELECT id, device_id, upload_id, motion_result, created_at
                FROM ecg_ml.motion_results
                WHERE device_id = ${deviceId}
                ORDER BY created_at DESC
                LIMIT ${limit} OFFSET ${offset}
              `).catch(() => ({ rows: [] }))
            ]);
            totalCount = Number(cRes?.rows?.[0]?.count || 0);
            rows = dataRes?.rows || [];
            break;
          }
          default:
            return res.status(400).json({ error: `Unknown table ${requestedTable}` });
        }

        return res.json({
          deviceId,
          table: requestedTable,
          page,
          limit,
          offset,
          totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
          rows,
        });
      }

      // 2. Fetch full overview with counts and first page for each table
      const [
        [cSessions],
        [cReadings],
        [cEvents],
        [cNetwork],
        cUploadsRes,
        cJobsRes,
        cResultsRes,
        cMotionRes,
        sessionsList,
        readingsList,
        eventsList,
        networkLocationList,
        uploadPacketsResult,
        analysisJobsResult,
        analysisResultsResult,
        motionResultsResult,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(telemetry_sessions).where(eq(telemetry_sessions.device_id, deviceId)).catch(() => [{ count: 0 }]),
        db.select({ count: sql<number>`count(*)::int` }).from(readings).where(eq(readings.device_id, deviceId)).catch(() => [{ count: 0 }]),
        db.select({ count: sql<number>`count(*)::int` }).from(events).where(eq(events.device_id, deviceId)).catch(() => [{ count: 0 }]),
        db.select({ count: sql<number>`count(*)::int` }).from(network_location).where(eq(network_location.device_id, deviceId)).catch(() => [{ count: 0 }]),
        db.execute(sql`SELECT count(*)::int as count FROM ecg_ml.upload_packets WHERE device_id = ${deviceId}`).catch(() => ({ rows: [{ count: 0 }] })),
        db.execute(sql`SELECT count(*)::int as count FROM ecg_ml.analysis_jobs WHERE device_id = ${deviceId}`).catch(() => ({ rows: [{ count: 0 }] })),
        db.execute(sql`SELECT count(*)::int as count FROM ecg_ml.analysis_results WHERE device_id = ${deviceId}`).catch(() => ({ rows: [{ count: 0 }] })),
        db.execute(sql`SELECT count(*)::int as count FROM ecg_ml.motion_results WHERE device_id = ${deviceId}`).catch(() => ({ rows: [{ count: 0 }] })),

        db.select().from(telemetry_sessions).where(eq(telemetry_sessions.device_id, deviceId)).orderBy(desc(telemetry_sessions.estimated_end_time)).limit(limit).catch(() => []),
        db.select().from(readings).where(eq(readings.device_id, deviceId)).orderBy(desc(readings.time)).limit(limit).catch(() => []),
        db.select().from(events).where(eq(events.device_id, deviceId)).orderBy(desc(events.id)).limit(limit).catch(() => []),
        db.select().from(network_location).where(eq(network_location.device_id, deviceId)).orderBy(desc(network_location.recorded_at)).limit(limit).catch(() => []),
        db.execute(sql`
          SELECT upload_id, device_id, start_ms, end_ms, body_sha256, received_at, created_at,
                 length(csv_text) as csv_bytes
          FROM ecg_ml.upload_packets
          WHERE device_id = ${deviceId}
          ORDER BY received_at DESC
          LIMIT ${limit}
        `).catch(() => ({ rows: [] })),
        db.execute(sql`
          SELECT job_id, device_id, first_upload_id, second_upload_id, third_upload_id,
                 model_sha256, status, attempts, next_attempt_at, lease_expires_at,
                 last_error_code, created_at, updated_at
                FROM ecg_ml.analysis_jobs
          WHERE device_id = ${deviceId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `).catch(() => ({ rows: [] })),
        db.execute(sql`
          SELECT job_id, schema_version, model_version, model_sha256, development_only,
                 device_id, input_start_ms, input_end_ms, label, quality, confidence,
                 requires_review, created_at
          FROM ecg_ml.analysis_results
          WHERE device_id = ${deviceId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `).catch(() => ({ rows: [] })),
        db.execute(sql`
          SELECT id, device_id, upload_id, motion_result, created_at
          FROM ecg_ml.motion_results
          WHERE device_id = ${deviceId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `).catch(() => ({ rows: [] })),
      ]);

      const counts = {
        sessions: Number(cSessions?.count || 0),
        readings: Number(cReadings?.count || 0),
        events: Number(cEvents?.count || 0),
        networkLocation: Number(cNetwork?.count || 0),
        uploadPackets: Number(cUploadsRes?.rows?.[0]?.count || 0),
        analysisJobs: Number(cJobsRes?.rows?.[0]?.count || 0),
        analysisResults: Number(cResultsRes?.rows?.[0]?.count || 0),
        motionResults: Number(cMotionRes?.rows?.[0]?.count || 0),
      };

      res.json({
        deviceId,
        page,
        limit,
        public: {
          sessions: sessionsList,
          readings: readingsList,
          events: eventsList,
        },
        networkLocation: networkLocationList,
        ecgMl: {
          uploadPackets: uploadPacketsResult?.rows || [],
          analysisJobs: analysisJobsResult?.rows || [],
          analysisResults: analysisResultsResult?.rows || [],
          motionResults: motionResultsResult?.rows || [],
        },
        counts,
      });
    } catch (err) {
      console.error('Error fetching device database tables:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET /api/analysis/qrs-motion/:deviceId?sessionId=xxx&start=xxx&end=xxx&range=xxx — Fast server-side peak-preserving downsampling
  app.get('/api/analysis/qrs-motion/:deviceId', async (req, res) => {
    try {
      const { sessionId, start, end, range } = req.query;

      // Available sessions list for selector
      const availableSessions = await db
        .select({
          id: telemetry_sessions.id,
          startTime: telemetry_sessions.estimated_start_time,
          endTime: telemetry_sessions.estimated_end_time,
          sampleCount: telemetry_sessions.sample_count,
        })
        .from(telemetry_sessions)
        .where(eq(telemetry_sessions.device_id, req.params.deviceId))
        .orderBy(desc(telemetry_sessions.estimated_end_time))
        .limit(20)
        .catch(() => []);

      let queryCondition;
      let targetSessionId = sessionId as string | undefined;

      if (sessionId) {
        queryCondition = sql`${readings.device_id} = ${req.params.deviceId} AND ${readings.session_id} = ${sessionId}`;
      } else if (start && end) {
        queryCondition = sql`${readings.device_id} = ${req.params.deviceId} AND ${readings.time} >= ${new Date(start as string)} AND ${readings.time} <= ${new Date(end as string)}`;
      } else if (range === '24h') {
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        queryCondition = sql`${readings.device_id} = ${req.params.deviceId} AND ${readings.time} >= ${since}`;
      } else if (range === '7d') {
        const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
        queryCondition = sql`${readings.device_id} = ${req.params.deviceId} AND ${readings.time} >= ${since}`;
      } else if (range === '30d') {
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        queryCondition = sql`${readings.device_id} = ${req.params.deviceId} AND ${readings.time} >= ${since}`;
      } else {
        // Default to latest session
        if (availableSessions.length > 0) {
          targetSessionId = availableSessions[0].id;
        } else {
          const [latest] = await db
            .select({ session_id: readings.session_id })
            .from(readings)
            .where(eq(readings.device_id, req.params.deviceId))
            .orderBy(desc(readings.time))
            .limit(1);
          if (latest) {
            targetSessionId = latest.session_id;
          }
        }
        if (targetSessionId) {
          queryCondition = sql`${readings.device_id} = ${req.params.deviceId} AND ${readings.session_id} = ${targetSessionId}`;
        }
      }

      if (!queryCondition) {
        return res.json({
          points: [],
          sessions: availableSessions,
          stats: {
            totalSamples: 0,
            durationSec: 0,
            avgMotionMg: 1000,
            motionArtifactCount: 0,
            signalStability: 100,
            estimatedBpm: null,
          }
        });
      }

      const rows = await db
        .select()
        .from(readings)
        .where(queryCondition)
        .orderBy(readings.time);

      if (rows.length === 0) {
        return res.json({
          points: [],
          sessions: availableSessions,
          stats: {
            totalSamples: 0,
            durationSec: 0,
            avgMotionMg: 1000,
            motionArtifactCount: 0,
            signalStability: 100,
            estimatedBpm: null,
          }
        });
      }

      // ECG ADS1292R scale conversion: raw * (2.42 / (6 * 8388607)) * 1000
      const ADS1292R_SCALE = (2.42 / (6 * 8388607)) * 1000;
      const toEcgMv = (val: number | null | undefined): number => {
        if (val === null || val === undefined || isNaN(val)) return 0;
        if (Math.abs(val) > 20) return Number((val * ADS1292R_SCALE).toFixed(3));
        return Number(val.toFixed(3));
      };

      const baseT = new Date(rows[0].time).getTime();
      let sumMotion = 0;
      let motionArtifactCount = 0;
      const parsedRows = rows.map((r, idx) => {
        const ax = r.accel_x || 0;
        const ay = r.accel_y || 0;
        const az = r.accel_z || 0;
        const mag = Math.sqrt(ax * ax + ay * ay + az * az);
        sumMotion += mag;
        if (Math.abs(mag - 1000) > 250) {
          motionArtifactCount++;
        }
        const t = new Date(r.time).getTime();
        const relSecNum = (t - baseT) / 1000;
        return {
          idx,
          t,
          relSec: `${relSecNum.toFixed(2)}s`,
          timeStr: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }),
          ecg: toEcgMv(r.ecg_ch2),
          motion: Math.round(mag),
        };
      });

      const total = parsedRows.length;
      const avgMotionMg = Math.round(sumMotion / total);
      const signalStability = Math.max(0, Math.min(100, Math.round(((total - motionArtifactCount) / total) * 100)));

      // Estimate Heart Rate (BPM) from R-peaks on ecg_ch2
      let peakCount = 0;
      const ecgValues = parsedRows.map(p => p.ecg);
      const maxEcg = Math.max(...ecgValues);
      const minEcg = Math.min(...ecgValues);
      const threshold = minEcg + (maxEcg - minEcg) * 0.65;
      let inPeak = false;
      for (let i = 0; i < ecgValues.length; i++) {
        if (ecgValues[i] > threshold && !inPeak) {
          peakCount++;
          inPeak = true;
        } else if (ecgValues[i] < threshold * 0.9) {
          inPeak = false;
        }
      }

      const durationMs = parsedRows[total - 1].t - parsedRows[0].t;
      const durationSec = durationMs > 0 ? durationMs / 1000 : total / 250;
      const estimatedBpm = durationSec > 0 ? Math.round((peakCount / durationSec) * 60) : 0;

      // Peak-preserving Min-Max decimation to TARGET_DISPLAY_POINTS
      const TARGET_DISPLAY_POINTS = 1000;
      let displayPoints: any[] = [];
      if (total <= TARGET_DISPLAY_POINTS) {
        displayPoints = parsedRows;
      } else {
        const bucketSize = total / (TARGET_DISPLAY_POINTS / 2);
        for (let b = 0; b < TARGET_DISPLAY_POINTS / 2; b++) {
          const startIdx = Math.floor(b * bucketSize);
          const endIdx = Math.min(total, Math.floor((b + 1) * bucketSize));
          if (startIdx >= endIdx) continue;

          let minIdx = startIdx;
          let maxIdx = startIdx;
          for (let i = startIdx + 1; i < endIdx; i++) {
            if (parsedRows[i].ecg < parsedRows[minIdx].ecg) minIdx = i;
            if (parsedRows[i].ecg > parsedRows[maxIdx].ecg) maxIdx = i;
          }

          if (minIdx < maxIdx) {
            displayPoints.push(parsedRows[minIdx]);
            displayPoints.push(parsedRows[maxIdx]);
          } else if (minIdx > maxIdx) {
            displayPoints.push(parsedRows[maxIdx]);
            displayPoints.push(parsedRows[minIdx]);
          } else {
            displayPoints.push(parsedRows[minIdx]);
          }
        }
      }

      res.json({
        sessionId: targetSessionId,
        points: displayPoints,
        sessions: availableSessions,
        stats: {
          totalSamples: total,
          pointsReturned: displayPoints.length,
          durationSec: Number(durationSec.toFixed(1)),
          avgMotionMg,
          motionArtifactCount,
          signalStability,
          estimatedBpm: estimatedBpm >= 40 && estimatedBpm <= 200 ? estimatedBpm : null,
        }
      });
    } catch (err: any) {
      console.error('Error in qrs-motion analysis:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // ECG ML Service proxy & fallback endpoints
  app.get('/api/ml/analyses/:deviceId/latest', async (req, res) => {
    const { deviceId } = req.params;
    try {
      if (ML_SERVICE_URL && ML_SERVICE_API_KEY) {
        try {
          const mlRes = await fetch(`${ML_SERVICE_URL}/v1/ecg/analyses/${encodeURIComponent(deviceId)}/latest`, {
            headers: {
              'Authorization': `Bearer ${ML_SERVICE_API_KEY}`,
              'Accept': 'application/json',
            },
          });
          if (mlRes.ok) {
            const data = await mlRes.json();
            return res.json(data);
          }
        } catch (fetchErr: any) {
          console.warn('ML Service unreachable, checking database:', fetchErr.message);
        }
      }

      // Query database directly if ecg_ml schema is applied
      const directResult: any = await db.execute(sql`
        SELECT job_id, schema_version, model_version, model_sha256, development_only,
               device_id, input_start_ms, input_end_ms, label, quality, confidence,
               requires_review, created_at
        FROM ecg_ml.analysis_results
        WHERE device_id = ${deviceId}
        ORDER BY created_at DESC
        LIMIT 1
      `).catch(() => null);

      if (directResult && directResult.rows && directResult.rows.length > 0) {
        return res.json(directResult.rows[0]);
      }

      return res.status(404).json({
        error: 'No ML analysis available yet for this device',
        requires_review: true,
      });
    } catch (err: any) {
      console.error('Error in /api/ml/analyses/:deviceId/latest:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/ml/analyses/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    try {
      if (ML_SERVICE_URL && ML_SERVICE_API_KEY) {
        try {
          const mlRes = await fetch(`${ML_SERVICE_URL}/v1/ecg/analyses/${encodeURIComponent(deviceId)}?limit=${limit}`, {
            headers: {
              'Authorization': `Bearer ${ML_SERVICE_API_KEY}`,
              'Accept': 'application/json',
            },
          });
          if (mlRes.ok) {
            const data = await mlRes.json();
            return res.json(data);
          }
        } catch (fetchErr: any) {
          console.warn('ML Service unreachable, checking database:', fetchErr.message);
        }
      }

      const directResult: any = await db.execute(sql`
        SELECT job_id, schema_version, model_version, model_sha256, development_only,
               device_id, input_start_ms, input_end_ms, label, quality, confidence,
               requires_review, created_at
        FROM ecg_ml.analysis_results
        WHERE device_id = ${deviceId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `).catch(() => null);

      return res.json(directResult?.rows || []);
    } catch (err: any) {
      console.error('Error in /api/ml/analyses/:deviceId:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/ml/jobs/:jobId', async (req, res) => {
    const { jobId } = req.params;
    try {
      if (ML_SERVICE_URL && ML_SERVICE_API_KEY) {
        try {
          const mlRes = await fetch(`${ML_SERVICE_URL}/v1/ecg/jobs/${encodeURIComponent(jobId)}`, {
            headers: {
              'Authorization': `Bearer ${ML_SERVICE_API_KEY}`,
              'Accept': 'application/json',
            },
          });
          if (mlRes.ok) {
            const data = await mlRes.json();
            return res.json(data);
          }
        } catch (fetchErr: any) {
          console.warn('ML Service unreachable, checking database:', fetchErr.message);
        }
      }

      const directResult: any = await db.execute(sql`
        SELECT *
        FROM ecg_ml.analysis_jobs
        WHERE job_id = ${jobId}::uuid
        LIMIT 1
      `).catch(() => null);

      if (directResult && directResult.rows && directResult.rows.length > 0) {
        return res.json(directResult.rows[0]);
      }

      return res.status(404).json({ error: 'Job not found' });
    } catch (err: any) {
      console.error('Error fetching ML job:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/ml/motion/:deviceId/latest', async (req, res) => {
    const { deviceId } = req.params;
    try {
      if (ML_SERVICE_URL && ML_SERVICE_API_KEY) {
        try {
          const mlRes = await fetch(`${ML_SERVICE_URL}/v1/ecg/motion/${encodeURIComponent(deviceId)}/latest`, {
            headers: {
              'Authorization': `Bearer ${ML_SERVICE_API_KEY}`,
              'Accept': 'application/json',
            },
          });
          if (mlRes.ok) {
            const data = await mlRes.json();
            return res.json(data);
          }
        } catch (fetchErr: any) {
          // Fall back to database query
        }
      }

      const directResult: any = await db.execute(sql`
        SELECT id, device_id, upload_id, motion_result, created_at
        FROM ecg_ml.motion_results
        WHERE device_id = ${deviceId}
        ORDER BY created_at DESC
        LIMIT 1
      `).catch(() => null);

      if (directResult && directResult.rows && directResult.rows.length > 0) {
        return res.json(directResult.rows[0]);
      }

      return res.status(404).json({ error: 'No motion result available yet for this device' });
    } catch (err: any) {
      console.error('Error fetching latest motion result:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/ml/motion/:deviceId', async (req, res) => {
    const { deviceId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    try {
      const directResult: any = await db.execute(sql`
        SELECT id, device_id, upload_id, motion_result, created_at
        FROM ecg_ml.motion_results
        WHERE device_id = ${deviceId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `).catch(() => null);

      return res.json(directResult?.rows || []);
    } catch (err: any) {
      console.error('Error fetching motion results:', err);
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
