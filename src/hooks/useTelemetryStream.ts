import { useState, useEffect, useCallback } from 'react';

export interface TelemetryPoint {
  time: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  ecg1: number;
  ecg2: number;
  magnitude: number;
}

export interface SessionMeta {
  sessionId: string;
  startTime: string;
  endTime: string;
  sampleCount: number;
  durationMs: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
}

export function useTelemetryStream(deviceId: string) {
  const [data, setData] = useState<TelemetryPoint[]>([]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'LOADED' | 'LOADING' | 'ERROR'>('LOADING');
  const [packetCount, setPacketCount] = useState(0);

  // Fetch available sessions for this device
  useEffect(() => {
    if (!deviceId) return;
    fetch(`/api/sessions/${deviceId}`)
      .then(r => r.ok ? r.json() : [])
      .then((s: SessionMeta[]) => {
        setSessions(s);
        // Auto-select the most recent session
        if (s.length > 0 && !selectedSessionId) {
          setSelectedSessionId(s[0].sessionId);
        }
      })
      .catch(() => setSessions([]));
  }, [deviceId]);

  // Fetch telemetry data when session changes
  useEffect(() => {
    if (!deviceId) return;

    const url = selectedSessionId
      ? `/api/telemetry/${deviceId}?sessionId=${encodeURIComponent(selectedSessionId)}`
      : `/api/telemetry/${deviceId}`;

    setConnectionStatus('LOADING');
    setData([]);

    fetch(url)
      .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
      .then((telemetry: any[]) => {
        // ECG conversion formula from ADS1292R 24-bit raw signed codes to mV:
        // raw * (2.42 / (6 * 8388607)) * 1000
        const ADS1292R_SCALE = (2.42 / (6 * 8388607)) * 1000;
        const toEcgMv = (val: number | null | undefined): number => {
          if (val === null || val === undefined || isNaN(val)) return 0;
          // If magnitude > 20, it is raw ADS1292R code (values in tens of thousands); otherwise already mV
          if (Math.abs(val) > 20) {
            return Number((val * ADS1292R_SCALE).toFixed(4));
          }
          return Number(val.toFixed(4));
        };

        const mappedData = telemetry.map((t: any) => ({
          time: new Date(t.time).getTime(),
          accelX: Number((t.accel_x || 0).toFixed(2)),
          accelY: Number((t.accel_y || 0).toFixed(2)),
          accelZ: Number((t.accel_z || 0).toFixed(2)),
          ecg1: toEcgMv(t.ecg_ch1),
          ecg2: toEcgMv(t.ecg_ch2),
          magnitude: Number(Math.sqrt(
            Math.pow(t.accel_x || 0, 2) +
            Math.pow(t.accel_y || 0, 2) +
            Math.pow(t.accel_z || 0, 2)
          ).toFixed(2)),
        }));
        setData(mappedData);
        setPacketCount(mappedData.length);
        setConnectionStatus('LOADED');
      })
      .catch(() => setConnectionStatus('ERROR'));
  }, [deviceId, selectedSessionId]);

  const clearBuffers = useCallback(() => {
    setData([]);
    setPacketCount(0);
  }, []);

  return {
    data,
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    connectionStatus,
    packetCount,
    clearBuffers,
    // legacy compatibility
    logs: [] as LogEntry[],
  };
}
