import React, { useRef, useEffect, useCallback } from 'react';
import { Activity, RotateCcw, ZoomIn } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Brush,
  Tooltip as RechartsTooltip,
  Area,
  AreaChart,
} from 'recharts';
import { useTelemetryStream } from '../hooks/useTelemetryStream';
export type { TelemetryPoint, LogEntry } from '../hooks/useTelemetryStream';

// --- TYPES ---
export interface TelemetryDashboardProps {
  deviceId: string;
  ownerName?: string;
  context: 'device-detail' | 'command-center';
}

// --- ChartHero Component ---
// Each chart gets its own independent Hero Section with its own Brush and scroll-zoom.
interface ChartHeroProps {
  title: string;
  tag: string;
  accentColor: string;
  data: any[];
  children: (visibleData: any[], yDomain: [number, number]) => React.ReactNode;
  yKeys: string[];         // which data keys to consider for vertical auto-scale
  defaultYDomain: [number, number];
  legend?: React.ReactNode;
}

function ChartHero({ title, tag, accentColor, data, children, yKeys, defaultYDomain, legend }: ChartHeroProps) {
  const [brushRange, setBrushRange] = React.useState<[number, number]>([0, Math.max(0, data.length - 1)]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep brush in sync when data changes
  useEffect(() => {
    setBrushRange([0, Math.max(0, data.length - 1)]);
  }, [data.length]);

  const visibleData = data.length > 0 ? data.slice(brushRange[0], brushRange[1] + 1) : [];

  // Auto-scale Y domain based on visible data
  const yDomain: [number, number] = React.useMemo(() => {
    if (visibleData.length === 0) return defaultYDomain;
    let min = Infinity, max = -Infinity;
    visibleData.forEach(d => {
      yKeys.forEach(key => {
        const v = d[key] ?? 0;
        if (v < min) min = v;
        if (v > max) max = v;
      });
    });
    if (min === max) return defaultYDomain;
    const pad = (max - min) * 0.1;
    return [min - pad, max + pad];
  }, [visibleData, yKeys, defaultYDomain]);

  // Mouse-wheel zoom: shrink/expand the brush range around the center
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (data.length < 2) return;

    const [start, end] = brushRange;
    const span = end - start;
    const center = Math.round((start + end) / 2);

    // Zoom in when scrolling up (deltaY < 0), zoom out when scrolling down
    const zoomFactor = e.deltaY < 0 ? 0.75 : 1.25;
    const newSpan = Math.max(1, Math.min(data.length - 1, Math.round(span * zoomFactor)));
    const half = Math.round(newSpan / 2);

    const newStart = Math.max(0, center - half);
    const newEnd = Math.min(data.length - 1, newStart + newSpan);
    setBrushRange([newStart, newEnd]);
  }, [brushRange, data.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const resetZoom = () => setBrushRange([0, Math.max(0, data.length - 1)]);

  return (
    <div className="border-b border-gray-200 dark:border-[#262626]">
      {/* Hero Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: accentColor }} />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-light-text dark:text-dark-text">{title}</h3>
            <span className="text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{tag}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {legend}
          <button
            onClick={resetZoom}
            title="Reset Zoom"
            className="flex items-center gap-1.5 px-2.5 py-1 border border-gray-200 dark:border-[#333] rounded-sm text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] hover:border-[#1B7A6E] transition-colors"
          >
            <RotateCcw size={10} /> Reset
          </button>
          <span className="hidden sm:flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#555]">
            <ZoomIn size={10} /> Scroll to zoom
          </span>
        </div>
      </div>

      {/* Chart Area */}
      <div ref={containerRef} className="px-2 pb-0" style={{ cursor: 'crosshair' }}>
        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visibleData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.15} />
              <XAxis
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                tick={{ fontSize: 9, fill: '#9A9A9A' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 10, fill: '#9A9A9A' }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v) => v.toFixed(1)}
              />
              <RechartsTooltip
                labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', borderRadius: '4px', fontSize: '11px', color: '#F2F2F2' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              {children(visibleData, yDomain)}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Full-width Brush Slider */}
        <div className="h-12 -mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} hide />
              {yKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke="#555" strokeWidth={0.5} dot={false} isAnimationActive={false} />
              ))}
              <Brush
                dataKey="time"
                height={28}
                stroke={accentColor}
                fill="#111"
                travellerWidth={6}
                tickFormatter={() => ''}
                startIndex={brushRange[0]}
                endIndex={brushRange[1]}
                onChange={(e) => {
                  if (e.startIndex !== undefined && e.endIndex !== undefined) {
                    setBrushRange([e.startIndex, e.endIndex]);
                  }
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function TelemetryDashboard({ deviceId, ownerName, context }: TelemetryDashboardProps) {
  const { data, connectionStatus, packetCount, clearBuffers } = useTelemetryStream(deviceId);

  const latestData = data[data.length - 1] || { accelX: 0, accelY: 0, accelZ: 0, ecg1: 0, ecg2: 0, magnitude: 0 };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-sm overflow-hidden text-light-text dark:text-dark-text">

      {/* ── Global Header ── */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#262626] bg-light-card dark:bg-[#111]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1B7A6E]/10 flex items-center justify-center rounded-sm">
            <Activity size={16} className="text-[#1B7A6E]" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest leading-tight">Sensor Telemetry</h2>
            <span className="text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] leading-tight">
              {deviceId} {ownerName ? `• ${ownerName}` : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status Pill */}
          <div className={`flex items-center px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${
            connectionStatus === 'LIVE'         ? 'border-[#1B7A6E]/30 text-[#1B7A6E] bg-[#1B7A6E]/5' :
            connectionStatus === 'RECONNECTING' ? 'border-[#D99B3F]/30 text-[#D99B3F] bg-[#D99B3F]/5' :
                                                  'border-[#C4453D]/30 text-[#C4453D] bg-[#C4453D]/5'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              connectionStatus === 'LIVE' ? 'bg-[#1B7A6E] animate-pulse' :
              connectionStatus === 'RECONNECTING' ? 'bg-[#D99B3F]' : 'bg-[#C4453D]'
            }`} />
            {connectionStatus}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{packetCount} pts</span>
          <button
            onClick={clearBuffers}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <RotateCcw size={12} /> Clear
          </button>
        </div>
      </div>

      {/* ── Top Stats Bar ── */}
      <div className="flex-none grid grid-cols-6 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-[#111]">
        {[
          { label: 'ACCEL X', value: latestData.accelX, unit: 'mg', color: '#1B7A6E' },
          { label: 'ACCEL Y', value: latestData.accelY, unit: 'mg', color: '#D99B3F' },
          { label: 'ACCEL Z', value: latestData.accelZ, unit: 'mg', color: '#C4453D' },
          { label: 'ECG CH1', value: latestData.ecg1,   unit: 'mV', color: '#1B7A6E' },
          { label: 'ECG CH2', value: latestData.ecg2,   unit: 'mV', color: '#7C8A94' },
          { label: '|Mag|',   value: latestData.magnitude, unit: 'mg', color: '#6366f1', isInt: true },
        ].map((m, i) => (
          <div key={m.label} className={`flex flex-col p-3 ${i < 5 ? 'border-r border-gray-200 dark:border-[#262626]' : ''}`}>
            <div className="h-0.5 w-full rounded-full mb-2 opacity-60" style={{ backgroundColor: m.color }} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{m.label}</span>
            <span className="text-base font-bold font-mono tracking-tight my-0.5">{m.isInt ? Math.round(m.value) : m.value.toFixed(2)}</span>
            <span className="text-[9px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{m.unit}</span>
          </div>
        ))}
      </div>

      {/* ── Hero Sections ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── 1. Accelerometer ── */}
        <ChartHero
          title="Accelerometer"
          tag="X · Y · Z Axes — mg"
          accentColor="#1B7A6E"
          data={data}
          yKeys={['accelX', 'accelY', 'accelZ']}
          defaultYDomain={[-1500, 1500]}
          legend={
            <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">
              <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#1B7A6E]" /> X</span>
              <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#D99B3F]" /> Y</span>
              <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#C4453D]" /> Z</span>
            </div>
          }
        >
          {() => (
            <>
              <Line type="monotone" dataKey="accelX" name="X (mg)" stroke="#1B7A6E" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="accelY" name="Y (mg)" stroke="#D99B3F" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="accelZ" name="Z (mg)" stroke="#C4453D" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </>
          )}
        </ChartHero>

        {/* ── 2. Magnitude ── */}
        <ChartHero
          title="Magnitude"
          tag="Vector Sum — mg"
          accentColor="#6366f1"
          data={data}
          yKeys={['magnitude']}
          defaultYDomain={[0, 2000]}
          legend={
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">
              <div className="w-3 h-0.5 bg-[#6366f1]" /> |Mag|
            </span>
          }
        >
          {() => (
            <Line type="monotone" dataKey="magnitude" name="|Mag| (mg)" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
          )}
        </ChartHero>

        {/* ── 3. ECG Channel 1 ── */}
        <ChartHero
          title="ECG Channel 1"
          tag="Lead I — mV"
          accentColor="#1B7A6E"
          data={data}
          yKeys={['ecg1']}
          defaultYDomain={[-2, 2]}
          legend={
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">
              <div className="w-3 h-0.5 bg-[#1B7A6E]" /> CH1
            </span>
          }
        >
          {() => (
            <Line type="monotone" dataKey="ecg1" name="ECG CH1 (mV)" stroke="#1B7A6E" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          )}
        </ChartHero>

        {/* ── 4. ECG Channel 2 ── */}
        <ChartHero
          title="ECG Channel 2"
          tag="Lead II — mV"
          accentColor="#7C8A94"
          data={data}
          yKeys={['ecg2']}
          defaultYDomain={[-2, 2]}
          legend={
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">
              <div className="w-3 h-0.5 bg-[#7C8A94]" /> CH2
            </span>
          }
        >
          {() => (
            <Line type="monotone" dataKey="ecg2" name="ECG CH2 (mV)" stroke="#7C8A94" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          )}
        </ChartHero>

      </div>
    </div>
  );
}
