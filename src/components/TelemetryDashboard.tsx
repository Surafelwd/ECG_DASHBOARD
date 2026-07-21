import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Activity, RotateCcw } from 'lucide-react';
import {
  LineChart,
  Line,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

// --- MOCK STREAM HOOK ---
// This acts as a placeholder for a real WebSocket or Supabase Realtime feed.
const MAX_VISIBLE_POINTS = 500;
const MAX_LOG_LINES = 100;

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

export function useMockTelemetryStream(deviceId: string) {
  const [data, setData] = useState<TelemetryPoint[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'LIVE' | 'RECONNECTING' | 'DISCONNECTED'>('LIVE');
  const [packetCount, setPacketCount] = useState(0);

  const dataRef = useRef<TelemetryPoint[]>([]);
  const logsRef = useRef<LogEntry[]>([]);
  const packetRef = useRef(0);
  const timeRef = useRef(0);

  const clearBuffers = useCallback(() => {
    dataRef.current = [];
    logsRef.current = [];
    packetRef.current = 0;
    setData([]);
    setLogs([]);
    setPacketCount(0);
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let lastLogTime = Date.now();

    const generateData = () => {
      timeRef.current += 1;
      const t = timeRef.current;
      
      // Simulate somewhat realistic sensor data
      const accelX = Math.sin(t / 20) * 500 + (Math.random() - 0.5) * 100;
      const accelY = Math.cos(t / 25) * 300 + (Math.random() - 0.5) * 100;
      const accelZ = 980 + Math.sin(t / 50) * 100 + (Math.random() - 0.5) * 50; // Gravity + noise
      
      // ECG simulation (QRS complex)
      const ecgCycle = t % 100;
      let ecg1 = (Math.random() - 0.5) * 0.1;
      let ecg2 = (Math.random() - 0.5) * 0.1;
      if (ecgCycle > 80 && ecgCycle < 85) {
        ecg1 += 1.5; // R peak
        ecg2 -= 0.8;
      } else if (ecgCycle >= 85 && ecgCycle < 88) {
        ecg1 -= 0.5; // S wave
        ecg2 += 0.3;
      } else if (ecgCycle > 30 && ecgCycle < 45) {
        ecg1 += Math.sin((ecgCycle - 30) / 15 * Math.PI) * 0.3; // T wave
        ecg2 += Math.sin((ecgCycle - 30) / 15 * Math.PI) * 0.2;
      }

      const magnitude = Math.sqrt(accelX*accelX + accelY*accelY + accelZ*accelZ);

      const newPoint: TelemetryPoint = {
        time: t,
        accelX,
        accelY,
        accelZ,
        ecg1,
        ecg2,
        magnitude
      };

      dataRef.current.push(newPoint);
      if (dataRef.current.length > MAX_VISIBLE_POINTS) {
        dataRef.current.shift();
      }

      packetRef.current += 1;
      
      const now = Date.now();
      if (now - lastLogTime > 2000) {
        const d = new Date();
        const ts = `[${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}]`;
        logsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          timestamp: ts,
          message: `Upload received — 50 rows`
        });
        if (logsRef.current.length > MAX_LOG_LINES) {
          logsRef.current.shift();
        }
        lastLogTime = now;
      }

      // We throttle React state updates to roughly 30fps to keep rendering smooth
      if (t % 2 === 0) {
        setData([...dataRef.current]);
        setLogs([...logsRef.current]);
        setPacketCount(packetRef.current);
      }

      animationFrameId = requestAnimationFrame(generateData);
    };

    animationFrameId = requestAnimationFrame(generateData);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [deviceId]);

  return {
    data,
    logs,
    connectionStatus,
    packetCount,
    clearBuffers
  };
}

// --- COMPONENTS ---

const GaugeSVG = ({ value, max, label, unit }: { value: number, max: number, label: string, unit: string }) => {
  const radius = 40;
  const stroke = 8;
  const normalizedValue = Math.min(Math.max(value, 0), max);
  const percentage = normalizedValue / max;
  
  // Arc angles (270 degrees total, starting bottom left)
  const startAngle = 135;
  const endAngle = 405;
  const currentAngle = startAngle + (percentage * 270);

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y, 
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  };

  return (
    <div className="flex flex-col items-center justify-center relative w-full h-32">
      <svg width="100" height="100" viewBox="0 0 100 100" className="absolute">
        {/* Background Arc */}
        <path 
          d={describeArc(50, 50, radius, startAngle, endAngle)} 
          fill="none" 
          stroke="currentColor" 
          strokeWidth={stroke} 
          className="text-gray-200 dark:text-[#262626]" 
          strokeLinecap="round" 
        />
        {/* Value Arc */}
        <path 
          d={describeArc(50, 50, radius, startAngle, currentAngle)} 
          fill="none" 
          stroke="currentColor" 
          strokeWidth={stroke} 
          className="text-[#1B7A6E]" 
          strokeLinecap="round" 
        />
      </svg>
      <div className="flex flex-col items-center justify-center z-10 pt-2">
        <span className="text-xl font-bold font-mono tracking-tight text-light-text dark:text-dark-text leading-none">{Math.round(value)}</span>
        <span className="text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mt-1">{unit}</span>
      </div>
    </div>
  );
};

export interface TelemetryDashboardProps {
  deviceId: string;
  ownerName?: string;
  context: 'device-detail' | 'command-center';
}

export default function TelemetryDashboard({ deviceId, ownerName, context }: TelemetryDashboardProps) {
  const { data, logs, connectionStatus, packetCount, clearBuffers } = useMockTelemetryStream(deviceId);
  
  const latestData = data[data.length - 1] || { accelX: 0, accelY: 0, accelZ: 0, ecg1: 0, ecg2: 0, magnitude: 0 };
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm overflow-hidden text-light-text dark:text-dark-text">
      
      {/* 1. Header Bar */}
      <div className="flex-none flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#262626] bg-light-card dark:bg-[#121212]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1B7A6E]/10 flex items-center justify-center rounded-sm">
            <Activity size={16} className="text-[#1B7A6E]" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-widest leading-tight">Sensor Telemetry</h2>
            <span className="text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] leading-tight mt-0.5">
              {context === 'device-detail' ? (
                <>Real-Time Board Monitor <span className="mx-1">•</span> {deviceId} {ownerName ? `(${ownerName})` : ''}</>
              ) : (
                <>Real-Time Board Monitor {ownerName ? `• ${ownerName}` : ''}</>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${
            connectionStatus === 'LIVE' ? 'border-[#1B7A6E]/30 text-[#1B7A6E] bg-[#1B7A6E]/5' :
            connectionStatus === 'RECONNECTING' ? 'border-[#D99B3F]/30 text-[#D99B3F] bg-[#D99B3F]/5' :
            'border-[#C4453D]/30 text-[#C4453D] bg-[#C4453D]/5'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              connectionStatus === 'LIVE' ? 'bg-[#1B7A6E] animate-pulse' :
              connectionStatus === 'RECONNECTING' ? 'bg-[#D99B3F]' :
              'bg-[#C4453D]'
            }`} />
            {connectionStatus}
          </div>
          <button 
            onClick={clearBuffers}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
          >
            <RotateCcw size={12} /> Clear
          </button>
        </div>
      </div>

      {/* 2. Top Metrics Row */}
      <div className="flex-none grid grid-cols-6 border-b border-gray-200 dark:border-[#262626]">
        {[
          { label: 'ACCEL X', value: latestData.accelX, unit: 'mg', color: '#1B7A6E' },
          { label: 'ACCEL Y', value: latestData.accelY, unit: 'mg', color: '#D99B3F' },
          { label: 'ACCEL Z', value: latestData.accelZ, unit: 'mg', color: '#C4453D' },
          { label: 'ECG CH1', value: latestData.ecg1, unit: 'mV', color: '#1B7A6E' },
          { label: 'ECG CH2', value: latestData.ecg2, unit: 'mV', color: '#7C8A94' },
          { label: 'PACKETS', value: packetCount, unit: 'RECEIVED', color: '#333333', isInt: true }
        ].map((metric, i) => (
          <div key={metric.label} className={`flex flex-col p-3 ${i < 5 ? 'border-r border-gray-200 dark:border-[#262626]' : ''}`}>
            <div className="h-0.5 w-full rounded-full mb-2 opacity-50" style={{ backgroundColor: metric.color }} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{metric.label}</span>
            <span className="text-lg font-bold font-mono tracking-tight my-0.5">
              {metric.isInt ? metric.value.toLocaleString() : metric.value.toFixed(1)}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{metric.unit}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 3. Two-Panel Row: Accelerometer + Magnitude */}
        <div className="flex flex-col md:flex-row border-b border-gray-200 dark:border-[#262626]">
          {/* Accelerometer */}
          <div className="w-full md:w-[60%] p-4 border-b md:border-b-0 md:border-r border-gray-200 dark:border-[#262626] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-widest">Accelerometer</h3>
                <span className="px-1.5 py-0.5 border border-gray-200 dark:border-[#333] rounded-sm text-[9px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">XYZ Axes</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">
                <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-[#1B7A6E]" /> X</span>
                <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-[#D99B3F]" /> Y</span>
                <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-[#C4453D]" /> Z</span>
              </div>
            </div>
            <div className="flex-1 min-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.2} />
                  <YAxis domain={[-1500, 1500]} tick={{ fontSize: 10, fill: '#9A9A9A' }} axisLine={false} tickLine={false} width={40} />
                  <Line type="monotone" dataKey="accelX" stroke="#1B7A6E" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="accelY" stroke="#D99B3F" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="accelZ" stroke="#C4453D" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Magnitude */}
          <div className="w-full md:w-[40%] p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest">Magnitude</h3>
              <span className="px-1.5 py-0.5 border border-gray-200 dark:border-[#333] rounded-sm text-[9px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Vector Sum</span>
            </div>
            <GaugeSVG value={latestData.magnitude} max={2000} label="Magnitude" unit="mg" />
            <div className="mt-4 space-y-2">
              {[
                { label: 'X', value: latestData.accelX, max: 1500, color: 'bg-[#1B7A6E]' },
                { label: 'Y', value: latestData.accelY, max: 1500, color: 'bg-[#D99B3F]' },
                { label: 'Z', value: latestData.accelZ, max: 1500, color: 'bg-[#C4453D]' }
              ].map(axis => (
                <div key={axis.label} className="flex items-center text-[10px] font-bold tracking-widest">
                  <span className="w-4 text-light-text-secondary dark:text-[#9A9A9A]">{axis.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#1a1a1a] rounded-full mx-2 overflow-hidden flex items-center">
                    <div className={`h-full ${axis.color}`} style={{ width: `${Math.min(100, (Math.abs(axis.value) / axis.max) * 100)}%` }} />
                  </div>
                  <span className="w-12 text-right font-mono">{axis.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Two-Panel Row: ECG CH1 + ECG CH2 */}
        <div className="flex flex-col md:flex-row border-b border-gray-200 dark:border-[#262626]">
          {[
            { id: '1', title: 'ECG Channel 1', tag: 'Lead I', dataKey: 'ecg1', color: '#1B7A6E' },
            { id: '2', title: 'ECG Channel 2', tag: 'Lead II', dataKey: 'ecg2', color: '#7C8A94' }
          ].map((ch, i) => (
            <div key={ch.id} className={`w-full md:w-1/2 p-4 flex flex-col ${i === 0 ? 'border-b md:border-b-0 md:border-r border-gray-200 dark:border-[#262626]' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest">{ch.title}</h3>
                  <span className="px-1.5 py-0.5 border border-gray-200 dark:border-[#333] rounded-sm text-[9px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{ch.tag}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">
                  <div className="w-2 h-0.5" style={{ backgroundColor: ch.color }} /> CH{ch.id}
                </div>
              </div>
              <div className="flex-1 min-h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.2} />
                    <YAxis domain={[-2, 2]} tick={{ fontSize: 10, fill: '#9A9A9A' }} axisLine={false} tickLine={false} width={30} />
                    <Line type="monotone" dataKey={ch.dataKey} stroke={ch.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        {/* 5. Event Log Stream */}
        <div className="flex flex-col h-48 md:h-64 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest">Event Log</h3>
            <span className="px-1.5 py-0.5 border border-gray-200 dark:border-[#333] rounded-sm text-[9px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Stream</span>
          </div>
          <div ref={logContainerRef} className="flex-1 bg-gray-50 dark:bg-[#000000] border border-gray-200 dark:border-[#262626] rounded-sm p-3 overflow-y-auto font-mono text-[10px] text-light-text-secondary dark:text-[#9A9A9A] space-y-1">
            {logs.length === 0 ? (
              <div className="italic opacity-50">Waiting for stream data...</div>
            ) : (
              logs.map(log => (
                <div key={log.id}>
                  <span className="text-[#1B7A6E] mr-2">{log.timestamp}</span>
                  <span className="text-light-text dark:text-[#F2F2F2]">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
