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

    let intervalId: any;

    const fetchData = async () => {
      try {
        setConnectionStatus(prev => prev === 'DISCONNECTED' ? 'RECONNECTING' : prev);
        const res = await fetch(`/api/telemetry/${deviceId}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const telemetry = await res.json();

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
          ) || 0
        }));

        setData(mappedData);
        setPacketCount(telemetry.length);
        setConnectionStatus('LIVE');
      } catch (err) {
        console.error('Error fetching telemetry:', err);
        setConnectionStatus('DISCONNECTED');
      }
    };

    fetchData();
    intervalId = setInterval(fetchData, 2000);

    return () => clearInterval(intervalId);
  }, [deviceId]);

  return { data, logs, connectionStatus, packetCount, clearBuffers };
}
