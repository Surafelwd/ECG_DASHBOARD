import React, { useRef, useCallback, useEffect } from 'react';
import { Activity, RotateCcw, ZoomIn, ChevronDown, Clock, Database, Calendar } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Brush,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useTelemetryStream, SessionMeta } from '../hooks/useTelemetryStream';
export type { TelemetryPoint, LogEntry } from '../hooks/useTelemetryStream';

// --- Types ---
export interface TelemetryDashboardProps {
  deviceId: string;
  ownerName?: string;
  context: 'device-detail' | 'command-center';
}

// --- Helpers ---
function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatSessionLabel(s: SessionMeta): string {
  const d = new Date(s.startTime);
  return d.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// --- ChartHero ---
interface ChartHeroProps {
  title: string;
  tag: string;
  accentColor: string;
  data: any[];
  yKeys: string[];
  defaultYDomain: [number, number];
  legend?: React.ReactNode;
  children: () => React.ReactNode;
}

function ChartHero({ title, tag, accentColor, data, yKeys, defaultYDomain, legend, children }: ChartHeroProps) {
  const [brushRange, setBrushRange] = React.useState<[number, number]>([0, Math.max(0, data.length - 1)]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBrushRange([0, Math.max(0, data.length - 1)]);
  }, [data.length]);

  const visibleData = data.length > 0 ? data.slice(brushRange[0], brushRange[1] + 1) : [];

  // Auto-scale Y based on visible window
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
    if (!isFinite(min) || min === max) return defaultYDomain;
    const pad = Math.abs(max - min) * 0.12;
    return [min - pad, max + pad];
  }, [visibleData, yKeys, defaultYDomain]);

  // Mouse-wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (data.length < 2) return;
    const [start, end] = brushRange;
    const span = end - start;
    const center = Math.round((start + end) / 2);
    const factor = e.deltaY < 0 ? 0.7 : 1.3;
    const newSpan = Math.max(1, Math.min(data.length - 1, Math.round(span * factor)));
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
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: accentColor }} />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest">{title}</h3>
            <span className="text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{tag}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {legend}
          <button
            onClick={resetZoom}
            className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 dark:border-[#333] rounded-sm text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] hover:border-[#1B7A6E] transition-colors"
          >
            <RotateCcw size={9} /> Reset
          </button>
          <span className="hidden sm:flex items-center gap-1 text-[9px] text-light-text-secondary dark:text-[#555] uppercase tracking-widest">
            <ZoomIn size={9} /> scroll to zoom
          </span>
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="px-2 pb-0" style={{ cursor: 'crosshair' }}>
        <div className="h-52">
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
                width={46}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <RechartsTooltip
                labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', borderRadius: '4px', fontSize: '11px', color: '#F2F2F2' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              {children()}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Full-width Brush (overview slider) */}
        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} hide />
              {yKeys.map(key => (
                <Line key={key} type="monotone" dataKey={key} stroke="#444" strokeWidth={0.5} dot={false} isAnimationActive={false} />
              ))}
              <Brush
                dataKey="time"
                height={26}
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

// --- Session Picker ---
function SessionPicker({ sessions, selectedSessionId, onSelect }: {
  sessions: SessionMeta[];
  selectedSessionId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = sessions.find(s => s.sessionId === selectedSessionId);

  if (sessions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">
        <Database size={12} /> No sessions found
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-sm text-[10px] font-bold uppercase tracking-widest text-light-text dark:text-[#F2F2F2] hover:border-[#1B7A6E] transition-colors"
      >
        <Calendar size={11} className="text-[#1B7A6E]" />
        {selected ? formatSessionLabel(selected) : 'Select Session'}
        <span className="ml-1 px-1.5 py-0.5 bg-[#1B7A6E]/10 text-[#1B7A6E] rounded-sm text-[8px]">
          {selected ? `${selected.sampleCount.toLocaleString()} pts` : ''}
        </span>
        <ChevronDown size={11} className={`ml-1 text-[#9A9A9A] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-[#1a1a1a] text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">
              {sessions.length} Session{sessions.length !== 1 ? 's' : ''} Available
            </div>
            <div className="max-h-64 overflow-y-auto">
              {sessions.map(s => (
                <button
                  key={s.sessionId}
                  onClick={() => { onSelect(s.sessionId); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 dark:border-[#1a1a1a] transition-colors hover:bg-gray-50 dark:hover:bg-[#1a1a1a] ${
                    s.sessionId === selectedSessionId ? 'bg-[#1B7A6E]/5 border-l-2 border-l-[#1B7A6E]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-light-text dark:text-[#F2F2F2]">{formatSessionLabel(s)}</span>
                    <span className="text-[9px] font-bold text-[#1B7A6E]">{s.sampleCount.toLocaleString()} pts</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[9px] text-light-text-secondary dark:text-[#9A9A9A]">
                    <span className="flex items-center gap-1"><Clock size={9} /> {formatDuration(s.durationMs)}</span>
                    <span>{new Date(s.startTime).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Main Component ---
export default function TelemetryDashboard({ deviceId, ownerName, context }: TelemetryDashboardProps) {
  const { data, sessions, selectedSessionId, setSelectedSessionId, connectionStatus, packetCount, clearBuffers } = useTelemetryStream(deviceId);

  const latestData = data[data.length - 1] || { accelX: 0, accelY: 0, accelZ: 0, ecg1: 0, ecg2: 0, magnitude: 0 };

  const selectedSession = sessions.find(s => s.sessionId === selectedSessionId);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-sm overflow-hidden text-light-text dark:text-dark-text">

      {/* ── Global Header ── */}
      <div className="flex-none flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#262626] bg-light-card dark:bg-[#111]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1B7A6E]/10 flex items-center justify-center rounded-sm">
            <Activity size={16} className="text-[#1B7A6E]" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest leading-tight">Sensor Telemetry</h2>
            <span className="text-[10px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">
              {deviceId}{ownerName ? ` · ${ownerName}` : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Session Picker */}
          <SessionPicker
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelect={setSelectedSessionId}
          />

          {/* Status */}
          <div className={`flex items-center px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${
            connectionStatus === 'LOADED' ? 'border-[#1B7A6E]/30 text-[#1B7A6E] bg-[#1B7A6E]/5' :
            connectionStatus === 'LOADING' ? 'border-[#D99B3F]/30 text-[#D99B3F] bg-[#D99B3F]/5' :
            'border-[#C4453D]/30 text-[#C4453D] bg-[#C4453D]/5'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              connectionStatus === 'LOADED' ? 'bg-[#1B7A6E]' :
              connectionStatus === 'LOADING' ? 'bg-[#D99B3F] animate-pulse' : 'bg-[#C4453D]'
            }`} />
            {connectionStatus}
          </div>

          <button
            onClick={clearBuffers}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <RotateCcw size={12} /> Clear
          </button>
        </div>
      </div>

      {/* ── Session Info Bar ── */}
      {selectedSession && (
        <div className="flex-none flex items-center gap-4 px-4 py-2 bg-[#1B7A6E]/5 border-b border-[#1B7A6E]/20 text-[10px] font-bold uppercase tracking-widest text-[#1B7A6E]">
          <span className="flex items-center gap-1.5"><Calendar size={10} /> {new Date(selectedSession.startTime).toLocaleDateString()}</span>
          <span className="flex items-center gap-1.5"><Clock size={10} /> {formatDuration(selectedSession.durationMs)} recording</span>
          <span className="flex items-center gap-1.5"><Database size={10} /> {selectedSession.sampleCount.toLocaleString()} samples → {packetCount.toLocaleString()} displayed</span>
          {selectedSession.sampleCount > packetCount && (
            <span className="text-[#D99B3F]">↓ Downsampled {Math.round(selectedSession.sampleCount / packetCount)}×</span>
          )}
        </div>
      )}

      {/* ── Stats Bar ── */}
      <div className="flex-none grid grid-cols-6 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-[#111]">
        {[
          { label: 'ACCEL X', value: latestData.accelX, unit: 'mg',  color: '#1B7A6E' },
          { label: 'ACCEL Y', value: latestData.accelY, unit: 'mg',  color: '#D99B3F' },
          { label: 'ACCEL Z', value: latestData.accelZ, unit: 'mg',  color: '#C4453D' },
          { label: 'ECG CH1', value: latestData.ecg1,   unit: 'mV',  color: '#1B7A6E' },
          { label: 'ECG CH2', value: latestData.ecg2,   unit: 'mV',  color: '#7C8A94' },
          { label: '|Mag|',   value: latestData.magnitude, unit: 'mg', color: '#6366f1' },
        ].map((m, i) => (
          <div key={m.label} className={`flex flex-col p-3 ${i < 5 ? 'border-r border-gray-200 dark:border-[#262626]' : ''}`}>
            <div className="h-0.5 w-full rounded-full mb-2 opacity-60" style={{ backgroundColor: m.color }} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{m.label}</span>
            <span className="text-base font-bold font-mono tracking-tight my-0.5">{m.value.toFixed(2)}</span>
            <span className="text-[9px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{m.unit}</span>
          </div>
        ))}
      </div>

      {/* ── Empty State ── */}
      {connectionStatus === 'LOADING' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-light-text-secondary dark:text-[#9A9A9A]">
            <div className="w-8 h-8 border-2 border-[#1B7A6E]/30 border-t-[#1B7A6E] rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Loading session data…</span>
          </div>
        </div>
      )}

      {connectionStatus !== 'LOADING' && data.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-light-text-secondary dark:text-[#9A9A9A] text-center p-8">
            <Database size={32} className="opacity-30" />
            <span className="text-xs font-bold uppercase tracking-widest">No data in this session</span>
            <span className="text-[10px]">Connect your hardware and send data via the ingest endpoint.</span>
          </div>
        </div>
      )}

      {/* ── Hero Chart Sections ── */}
      {data.length > 0 && (
        <div className="flex-1 overflow-y-auto">

          {/* 1. Accelerometer */}
          <ChartHero
            title="Accelerometer" tag="X · Y · Z Axes — mg"
            accentColor="#1B7A6E" data={data}
            yKeys={['accelX', 'accelY', 'accelZ']} defaultYDomain={[-1500, 1500]}
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
                <Line type="monotone" dataKey="accelX" name="X (mg)" stroke="#1B7A6E" strokeWidth={1.5} dot={data.length < 50} isAnimationActive={false} />
                <Line type="monotone" dataKey="accelY" name="Y (mg)" stroke="#D99B3F" strokeWidth={1.5} dot={data.length < 50} isAnimationActive={false} />
                <Line type="monotone" dataKey="accelZ" name="Z (mg)" stroke="#C4453D" strokeWidth={1.5} dot={data.length < 50} isAnimationActive={false} />
              </>
            )}
          </ChartHero>

          {/* 2. Magnitude */}
          <ChartHero
            title="Magnitude" tag="Vector Sum — mg"
            accentColor="#6366f1" data={data}
            yKeys={['magnitude']} defaultYDomain={[0, 2000]}
            legend={<span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]"><div className="w-3 h-0.5 bg-[#6366f1]" /> |Mag|</span>}
          >
            {() => (
              <Line type="monotone" dataKey="magnitude" name="|Mag| (mg)" stroke="#6366f1" strokeWidth={2} dot={data.length < 50} isAnimationActive={false} />
            )}
          </ChartHero>

          {/* 3. ECG Channel 1 */}
          <ChartHero
            title="ECG Channel 1" tag="Lead I — mV"
            accentColor="#1B7A6E" data={data}
            yKeys={['ecg1']} defaultYDomain={[-2, 2]}
            legend={<span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]"><div className="w-3 h-0.5 bg-[#1B7A6E]" /> CH1</span>}
          >
            {() => (
              <Line type="monotone" dataKey="ecg1" name="ECG CH1 (mV)" stroke="#1B7A6E" strokeWidth={1.5} dot={data.length < 50} isAnimationActive={false} />
            )}
          </ChartHero>

          {/* 4. ECG Channel 2 */}
          <ChartHero
            title="ECG Channel 2" tag="Lead II — mV"
            accentColor="#7C8A94" data={data}
            yKeys={['ecg2']} defaultYDomain={[-2, 2]}
            legend={<span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]"><div className="w-3 h-0.5 bg-[#7C8A94]" /> CH2</span>}
          >
            {() => (
              <Line type="monotone" dataKey="ecg2" name="ECG CH2 (mV)" stroke="#7C8A94" strokeWidth={1.5} dot={data.length < 50} isAnimationActive={false} />
            )}
          </ChartHero>

        </div>
      )}
    </div>
  );
}
