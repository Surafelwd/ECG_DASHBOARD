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
        const mappedData = telemetry.map((t: any) => ({
          time: new Date(t.time).getTime(),
          accelX: t.accel_x || 0,
          accelY: t.accel_y || 0,
          accelZ: t.accel_z || 0,
          ecg1: t.ecg_ch1 || 0,
          ecg2: t.ecg_ch2 || 0,
          magnitude: Math.sqrt(
            Math.pow(t.accel_x || 0, 2) +
            Math.pow(t.accel_y || 0, 2) +
            Math.pow(t.accel_z || 0, 2)
          ),
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
