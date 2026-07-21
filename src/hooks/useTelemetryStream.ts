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

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
}

export function useTelemetryStream(deviceId: string) {
  const [data, setData] = useState<TelemetryPoint[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'LIVE' | 'RECONNECTING' | 'DISCONNECTED'>('RECONNECTING');
  const [packetCount, setPacketCount] = useState(0);

  const clearBuffers = useCallback(() => {
    setData([]);
    setLogs([]);
    setPacketCount(0);
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    const fetchData = async () => {
      try {
        setConnectionStatus(prev => prev === 'DISCONNECTED' ? 'RECONNECTING' : prev);
        const res = await fetch(`/api/telemetry/${deviceId}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const telemetry = await res.json();

        const mappedData = telemetry.map((t: any) => ({
          time: new Date(t.timestamp).getTime(),
          timestamp: new Date(t.timestamp).toLocaleTimeString(),
          accelX: t.accelX || 0,
          accelY: t.accelY || 0,
          accelZ: t.accelZ || 0,
          ecg1: t.ecgCh1 || 0,
          ecg2: t.ecgCh2 || 0,
          magnitude: Math.sqrt(
            Math.pow(t.accelX || 0, 2) +
            Math.pow(t.accelY || 0, 2) +
            Math.pow(t.accelZ || 0, 2)
          ) || 0
        })).reverse(); // Reverse to have chronological order for graphs

        setData(mappedData);
        setPacketCount(telemetry.length);
        setConnectionStatus('LIVE');
      } catch (err) {
        console.error('Error fetching telemetry:', err);
        setConnectionStatus('DISCONNECTED');
      }
    };

    fetchData();
  }, [deviceId]);

  return { data, logs, connectionStatus, packetCount, clearBuffers };
}
