import { useCallback, useEffect, useState } from 'react';
import { ecgCh2CountsToMv } from '../lib/telemetry-contract.mjs';

export interface TelemetryPoint {
  timeMs: number;
  elapsedSeconds: number;
  accelXMg: number;
  accelYMg: number;
  accelZMg: number;
  magnitudeMg: number;
  dynamicMotionMg: number;
  ecgCh1Count: number;
  ecgCh2Count: number;
  ecgCh2Mv: number;
}

export interface SessionMeta {
  sessionId: string;
  startTime: string;
  endTime: string;
  receivedAt: string;
  sampleCount: number;
  durationMs: number;
  sampleRateHz: number | null;
  timeBasis: 'estimated-from-upload';
  batteryVoltageMv: number | null;
}

export function useTelemetryStream(deviceId: string) {
  const [data, setData] = useState<TelemetryPoint[]>([]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'LOADED' | 'LOADING' | 'ERROR'>('LOADING');
  const [refreshSequence, setRefreshSequence] = useState(0);

  useEffect(() => {
    setSelectedSessionId(null);
    setData([]);
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;
    let cancelled = false;

    const loadSessions = async () => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(deviceId)}`);
        if (!response.ok) throw new Error('Unable to load recordings');
        const result: SessionMeta[] = await response.json();
        if (cancelled) return;
        setSessions(result);
        setSelectedSessionId((current) => current && result.some((session) => session.sessionId === current)
          ? current
          : result[0]?.sessionId || null);
      } catch {
        if (!cancelled) {
          setSessions([]);
          setConnectionStatus('ERROR');
        }
      }
    };

    loadSessions();
    const timer = window.setInterval(loadSessions, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deviceId, refreshSequence]);

  useEffect(() => {
    if (!deviceId || !selectedSessionId) {
      setData([]);
      setConnectionStatus('LOADED');
      return;
    }

    const controller = new AbortController();
    setConnectionStatus('LOADING');
    fetch(`/api/telemetry/${encodeURIComponent(deviceId)}?sessionId=${encodeURIComponent(selectedSessionId)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load recording');
        return response.json();
      })
      .then((telemetry: any[]) => {
        const firstTime = telemetry.length > 0 ? new Date(telemetry[0].time).getTime() : 0;
        const mapped = telemetry.map((reading) => {
          const timeMs = new Date(reading.time).getTime();
          const accelXMg = Number(reading.accel_x ?? 0);
          const accelYMg = Number(reading.accel_y ?? 0);
          const accelZMg = Number(reading.accel_z ?? 0);
          const ecgCh1Count = Number(reading.ecg_ch1 ?? 0);
          const ecgCh2Count = Number(reading.ecg_ch2 ?? 0);
          const magnitudeMg = Math.sqrt(accelXMg ** 2 + accelYMg ** 2 + accelZMg ** 2);
          return {
            timeMs,
            elapsedSeconds: (timeMs - firstTime) / 1000,
            accelXMg,
            accelYMg,
            accelZMg,
            magnitudeMg,
            dynamicMotionMg: Math.abs(magnitudeMg - 1000),
            ecgCh1Count,
            ecgCh2Count,
            ecgCh2Mv: ecgCh2CountsToMv(ecgCh2Count),
          };
        });
        setData(mapped);
        setConnectionStatus('LOADED');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setConnectionStatus('ERROR');
      });

    return () => controller.abort();
  }, [deviceId, selectedSessionId, refreshSequence]);

  const refresh = useCallback(() => setRefreshSequence((value) => value + 1), []);

  return {
    data,
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    connectionStatus,
    refresh,
  };
}
