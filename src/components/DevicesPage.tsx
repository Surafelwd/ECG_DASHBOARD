import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search, Filter, X, Signal, SignalZero, SignalLow, SignalMedium, SignalHigh,
  AlertTriangle, ArrowLeft, Download, Clock, User, Hash, HardDrive, Wifi, WifiOff, FileText, ChevronLeft, ChevronRight, CheckSquare, Square, Zap, RefreshCw, Smartphone, Activity,
  ZoomIn, ZoomOut, RotateCcw, Database
} from 'lucide-react';
import DeviceDatabaseTables from './DeviceDatabaseTables';
import { motion, AnimatePresence } from 'motion/react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Brush
} from 'recharts';

// --- TYPES ---
export interface DevicesPageProps {
  userRole?: string;
  devices?: any[];
  isLoading?: boolean;
  getDeviceDetail?: (deviceId: string) => Promise<any>;
  onManageCommands?: (deviceId: string) => void;
  onExportReadings?: (deviceId: string, filters: any) => void;
  onClearFilters?: () => void;
  initialSelectedDeviceId?: string | null;
  onViewTelemetry?: (deviceId: string) => void;
}

// --- HELPER COMPONENTS ---

function Sparkline({ data, color = '#1B7A6E', height = 20, width = 50 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

const StatusBadge = ({ isOnline }: { isOnline: boolean }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${isOnline
    ? 'bg-[#1B7A6E]/10 text-[#1B7A6E] border border-[#1B7A6E]/20'
    : 'bg-[#C4453D]/10 text-[#C4453D] border border-[#C4453D]/20'
    }`}>
    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-[#1B7A6E]' : 'bg-[#C4453D]'}`}></span>
    {isOnline ? 'Online' : 'Offline'}
  </span>
);

const MotionQualityIndicator = ({ quality = 'Active', sparkData }: { quality?: string, sparkData?: number[] }) => {
  return (
    <div className="flex items-center gap-3">
      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#1B7A6E]/10 text-[#1B7A6E] border border-[#1B7A6E]/30 flex items-center gap-1">
        <Activity size={10} />
        {quality}
      </span>
      {sparkData && <Sparkline data={sparkData} color="#1B7A6E" />}
    </div>
  );
};

const SignalIndicator = ({ strength, sparkData }: { strength: number, sparkData?: number[] }) => {
  let Icon = Signal;
  if (strength === 0) Icon = SignalZero;
  else if (strength === 1) Icon = SignalLow;
  else if (strength === 2) Icon = SignalMedium;
  else if (strength >= 3) Icon = SignalHigh;

  const color = strength > 0 ? 'text-[#1B7A6E]' : 'text-[#C4453D]';
  const hexColor = strength > 0 ? '#1B7A6E' : '#C4453D';

  return (
    <div className="flex items-center gap-3">
      <Icon className={color} size={16} />
      {sparkData && <Sparkline data={sparkData} color={hexColor} />}
    </div>
  );
};

const defaultGetDeviceDetail = async (deviceId: string) => {
  try {
    const telRes = await fetch(`/api/telemetry/${deviceId}`);
    const readings = await telRes.json();
    return {
      signalAnalysis: {
        averageSignalRate: '100%',
        totalReadings: readings?.length?.toString() || '0',
        dataCompleteness: '100%',
        motionIncidents: 0,
        trendData: []
      },
      motionArtifactFlags: [],
      readings: (Array.isArray(readings) ? readings : []).map((r: any) => ({
        id: r.id,
        timestamp: new Date(r.time).toLocaleString([], { timeZone: 'UTC' }),
        accelX: r.accel_x,
        accelY: r.accel_y,
        accelZ: r.accel_z,
        ecgCh1: r.ecg_ch1,
        ecgCh2: r.ecg_ch2,
        sessionId: r.session_id
      })),
      readingSessions: []
    };
  } catch (e) {
    return null;
  }
};

const DeviceAnalysisSection = ({ device }: { device: any }) => {
  const [qrsData, setQrsData] = useState<{
    sessionId?: string;
    points: any[];
    stats: {
      totalSamples: number;
      durationSec: number;
      avgMotionMg: number;
      motionArtifactCount: number;
      signalStability: number;
      estimatedBpm: number | null;
    };
  } | null>(null);
  const [isLoadingQrs, setIsLoadingQrs] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [brushRange, setBrushRange] = useState<[number, number]>([0, 0]);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [mlResult, setMlResult] = useState<{
    label?: string;
    quality?: string;
    confidence?: number;
    requires_review?: boolean;
    created_at?: string;
    model_version?: number;
  } | null>(null);
  const [motionResult, setMotionResult] = useState<{
    id?: number;
    upload_id?: string;
    motion_result?: any;
    created_at?: string;
  } | null>(null);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [isLoadingAlarms, setIsLoadingAlarms] = useState(false);
  const [mlAnalyses, setMlAnalyses] = useState<any[]>([]);
  const [motionHistory, setMotionHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!device?.id) return;
    setIsLoadingQrs(true);
    const query = selectedSessionId ? `?sessionId=${encodeURIComponent(selectedSessionId)}` : '';
    fetch(`/api/analysis/qrs-motion/${encodeURIComponent(device.id)}${query}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Array.isArray(data.points)) {
          setQrsData(data);
          if (Array.isArray(data.sessions)) {
            setAvailableSessions(data.sessions);
          }
        }
        setIsLoadingQrs(false);
      })
      .catch(() => {
        setIsLoadingQrs(false);
      });

    // 1. Fetch latest 30-second continuous ECG rhythm classification (analysis_result)
    fetch(`/api/ml/analyses/${encodeURIComponent(device.id)}/latest`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.label) {
          setMlResult(data);
        } else {
          setMlResult(null);
        }
      })
      .catch(() => {
        setMlResult(null);
      });

    // 2. Fetch latest 10-second upload motion analysis (motion_result)
    fetch(`/api/ml/motion/${encodeURIComponent(device.id)}/latest`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && (data.motion_result || data.activity_level !== undefined || data.avg_motion_mg !== undefined)) {
          setMotionResult(data);
        } else {
          setMotionResult(null);
        }
      })
      .catch(() => {
        setMotionResult(null);
      });

    setIsLoadingAlarms(true);
    fetch(`/api/alarms?deviceId=${encodeURIComponent(device.id)}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setAlarms(Array.isArray(data) ? data : []);
        setIsLoadingAlarms(false);
      })
      .catch(() => {
        setIsLoadingAlarms(false);
      });

    // Fetch ML analyses history for Rhythm History chart
    fetch(`/api/ml/analyses/${encodeURIComponent(device.id)}?limit=20`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setMlAnalyses(Array.isArray(data) ? [...data].reverse() : []))
      .catch(() => setMlAnalyses([]));

    // Fetch motion history for Posture Timeline chart
    fetch(`/api/ml/motion/${encodeURIComponent(device.id)}?limit=20`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setMotionHistory(Array.isArray(data) ? data : []))
      .catch(() => setMotionHistory([]));
  }, [device?.id, selectedSessionId]);

  const chartPoints = qrsData?.points && qrsData.points.length > 0 ? qrsData.points : [];

  useEffect(() => {
    if (chartPoints.length > 0) {
      setBrushRange([0, chartPoints.length - 1]);
    }
  }, [chartPoints.length, selectedSessionId]);

  // Mouse-wheel zoom inside waveform
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (chartPoints.length < 6) return;
    const [start, end] = brushRange;
    const span = end - start;
    const center = Math.round((start + end) / 2);
    const factor = e.deltaY < 0 ? 0.75 : 1.3;
    const newSpan = Math.max(8, Math.min(chartPoints.length - 1, Math.round(span * factor)));
    const half = Math.round(newSpan / 2);
    const newStart = Math.max(0, center - half);
    const newEnd = Math.min(chartPoints.length - 1, newStart + newSpan);
    setBrushRange([newStart, newEnd]);
  }, [brushRange, chartPoints.length]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const zoomIn = () => {
    if (chartPoints.length < 6) return;
    const [start, end] = brushRange;
    const span = end - start;
    const center = Math.round((start + end) / 2);
    const newSpan = Math.max(8, Math.round(span * 0.7));
    const half = Math.round(newSpan / 2);
    setBrushRange([Math.max(0, center - half), Math.min(chartPoints.length - 1, center + half)]);
  };

  const zoomOut = () => {
    if (chartPoints.length < 6) return;
    const [start, end] = brushRange;
    const span = end - start;
    const center = Math.round((start + end) / 2);
    const newSpan = Math.min(chartPoints.length - 1, Math.round(span * 1.4));
    const half = Math.round(newSpan / 2);
    setBrushRange([Math.max(0, center - half), Math.min(chartPoints.length - 1, center + half)]);
  };

  const selectTimeSpan = (fraction: number) => {
    if (chartPoints.length < 6) return;
    if (fraction >= 1) {
      setBrushRange([0, chartPoints.length - 1]);
      return;
    }
    const [start, end] = brushRange;
    const center = Math.round((start + end) / 2);
    const newSpan = Math.max(8, Math.round(chartPoints.length * fraction));
    const half = Math.round(newSpan / 2);
    const newStart = Math.max(0, center - half);
    const newEnd = Math.min(chartPoints.length - 1, newStart + newSpan);
    setBrushRange([newStart, newEnd]);
  };

  const resetZoom = () => {
    if (chartPoints.length > 0) {
      setBrushRange([0, chartPoints.length - 1]);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3.5">
      <div className="flex flex-col gap-3.5">

        {/* 1. QRS vs. Motion Artifacts */}
        <div className="card-3d p-3.5 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-[#9A9A9A] flex items-center">
              <Activity size={13} className="mr-1.5 text-[#22c55e]" /> QRS Complex vs. Motion Artifacts
            </h3>

            {/* Session Selector, Time Range & Zoom Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              {availableSessions.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-[#9A9A9A]">Session:</span>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded text-[10px] font-mono px-1.5 py-0.5 text-light-text dark:text-[#F2F2F2] outline-none"
                  >
                    <option value="">Latest ({qrsData?.stats.durationSec ?? 10}s)</option>
                    {availableSessions.map((s, idx) => (
                      <option key={s.id || idx} value={s.id}>
                        {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })} ({Number(s.sampleCount).toLocaleString()} pts)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Time Range Selection */}
              <div className="flex items-center gap-0.5 border border-gray-200 dark:border-[#333] rounded px-1 py-0.5 bg-gray-50 dark:bg-[#181818] text-[9px] font-mono">
                <span className="text-light-text-secondary dark:text-[#888] pr-0.5">Range:</span>
                {[
                  { label: 'All', frac: 1.0 },
                  { label: '5s', frac: 0.5 },
                  { label: '2s', frac: 0.2 },
                  { label: '1s', frac: 0.1 },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    onClick={() => selectTimeSpan(btn.frac)}
                    className="px-1 py-0.2 rounded hover:bg-gray-200 dark:hover:bg-[#282828] text-light-text dark:text-[#DDD] transition-colors"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Zoom In, Zoom Out, Reset */}
              <div className="flex items-center gap-0.5 border border-gray-200 dark:border-[#333] rounded p-0.5 bg-gray-50 dark:bg-[#181818]">
                <button
                  onClick={zoomIn}
                  title="Zoom In (+)"
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#262626] text-light-text dark:text-[#F2F2F2] transition-colors"
                >
                  <ZoomIn size={11} />
                </button>
                <button
                  onClick={zoomOut}
                  title="Zoom Out (-)"
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#262626] text-light-text dark:text-[#F2F2F2] transition-colors"
                >
                  <ZoomOut size={11} />
                </button>
                <button
                  onClick={resetZoom}
                  title="Reset Zoom"
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#262626] text-light-text dark:text-[#F2F2F2] transition-colors"
                >
                  <RotateCcw size={11} />
                </button>
              </div>

              {qrsData?.stats && (
                <div className="flex items-center gap-1 text-[9px] font-mono">
                  {qrsData.stats.estimatedBpm && (
                    <span className="px-1 py-0.5 rounded bg-[#1B7A6E]/10 text-[#1B7A6E] border border-[#1B7A6E]/20 font-bold">
                      ♥ {qrsData.stats.estimatedBpm} BPM
                    </span>
                  )}
                  <span className="px-1 py-0.5 rounded bg-[#1B7A6E]/10 text-[#1B7A6E] border border-[#1B7A6E]/20">
                    Clean: {qrsData.stats.signalStability}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div
            ref={chartContainerRef}
            className="h-[520px] md:h-[580px] bg-gray-50 dark:bg-[#0a0a0a] rounded-sm p-1.5 border border-gray-100 dark:border-[#1a1a1a] cursor-crosshair select-none"
          >
            {isLoadingQrs ? (
              <div className="h-full flex items-center justify-center text-xs text-light-text-secondary dark:text-[#9A9A9A]">
                <div className="w-5 h-5 border-2 border-[#1B7A6E]/30 border-t-[#1B7A6E] rounded-full animate-spin mr-2" />
                Processing session data...
              </div>
            ) : chartPoints.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-light-text-secondary dark:text-[#9A9A9A]">
                No sensor readings available for this device yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartPoints}
                  margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" opacity={0.3} />
                  <XAxis dataKey="relSec" tick={{ fontSize: 9, fill: '#9A9A9A' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#1B7A6E' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}mV`} />
                  <YAxis yAxisId="right" orientation="right" domain={[500, 1800]} tick={{ fontSize: 9, fill: '#C4453D' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}mg`} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0].payload;
                      const isArtifact = (pt.motion ?? 0) > 1150;
                      return (
                        <div className="bg-[#121212] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-[11px] shadow-2xl space-y-1 z-50">
                          <div className="flex items-center justify-between gap-3 border-b border-[#262626] pb-1 text-[#9A9A9A] font-mono text-[9px]">
                            <span>{pt.timeStr ? `${pt.timeStr} UTC` : `+${pt.relSec}`}</span>
                            <span className="text-[#1B7A6E] font-bold">+{pt.relSec}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-[#1B7A6E] font-semibold text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1B7A6E]" /> ECG Lead II:
                            </span>
                            <span className="font-mono font-bold text-white text-[10px]">
                              {typeof pt.ecg === 'number' ? pt.ecg.toFixed(3) : pt.ecg} mV
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-[#C4453D] font-semibold text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C4453D]" /> Accel Mag:
                            </span>
                            <span className="font-mono font-bold text-white text-[10px]">
                              {typeof pt.motion === 'number' ? pt.motion.toFixed(1) : pt.motion} mg
                            </span>
                          </div>
                          {isArtifact && (
                            <div className="text-[9px] text-[#D99B3F] font-mono pt-0.5">
                              ⚠ Motion spike detected
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Area yAxisId="right" type="step" dataKey="motion" name="Motion Magnitude (mg)" fill="#C4453D" fillOpacity={0.15} stroke="#C4453D" strokeWidth={1} isAnimationActive={false} />
                  <Line yAxisId="left" type="monotone" dataKey="ecg" name="ECG Lead II (mV)" stroke="#1B7A6E" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Brush
                    dataKey="relSec"
                    height={26}
                    stroke="#1B7A6E"
                    fill="#121212"
                    startIndex={brushRange[0]}
                    endIndex={brushRange[1]}
                    onChange={(r: any) => {
                      if (r && typeof r.startIndex === 'number' && typeof r.endIndex === 'number') {
                        setBrushRange([r.startIndex, r.endIndex]);
                      }
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {qrsData?.stats && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center border-t border-gray-100 dark:border-[#1a1a1a] pt-1.5">
              <div>
                <span className="text-[8px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Mean Acceleration</span>
                <p className="text-xs font-mono font-bold">{qrsData.stats.avgMotionMg} mg</p>
              </div>
              <div>
                <span className="text-[8px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Motion Artifacts</span>
                <p className="text-xs font-mono font-bold text-[#C4453D]">{qrsData.stats.motionArtifactCount} samples</p>
              </div>
              <div>
                <span className="text-[8px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Clean Signal Rate</span>
                <p className="text-xs font-mono font-bold text-[#1B7A6E]">{qrsData.stats.signalStability}%</p>
              </div>
              <div>
                <span className="text-[8px] uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Heart Rate Estimate</span>
                <p className="text-xs font-mono font-bold text-[#1B7A6E]">{qrsData.stats.estimatedBpm ? `${qrsData.stats.estimatedBpm} BPM` : 'Stable'}</p>
              </div>
            </div>
          )}
        </div>


        {/* 3. AI Health Insights (Graphical & ML Model Results) */}
        <div className="card-3d p-3.5 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] flex items-center">
              <Zap size={13} className="mr-1.5 text-[#D99B3F]" /> ECG Machine Learning & Clinical Insights
            </h3>
            <div className="flex items-center gap-1.5">
              {/* 10s Motion Badge */}
              {motionResult && (
                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#1B7A6E]/10 text-[#1B7A6E] border border-[#1B7A6E]/30 flex items-center gap-1">
                  <Activity size={10} />
                  10s Motion: {
                    (motionResult.motion_result?.verdict === 'supine' ? 'Supine' :
                     motionResult.motion_result?.verdict === 'upright_stationary' ? 'Upright Stationary' :
                     motionResult.motion_result?.verdict === 'walking' ? 'Walking' :
                     motionResult.motion_result?.verdict || motionResult.motion_result?.activity_level || 'Active')
                  }
                  {motionResult.motion_result?.confidence !== undefined && ` (${(motionResult.motion_result.confidence * 100).toFixed(0)}%)`}
                </span>
              )}
              {/* 30s Rhythm Badge */}
              {mlResult && (
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${mlResult.label === 'normal'
                    ? 'bg-[#1B7A6E]/10 text-[#1B7A6E] border-[#1B7A6E]/30'
                    : mlResult.label === 'af_suspected'
                      ? 'bg-[#C4453D]/10 text-[#C4453D] border-[#C4453D]/30'
                      : 'bg-[#D99B3F]/10 text-[#D99B3F] border-[#D99B3F]/30'
                  }`}>
                  {mlResult.label === 'normal' ? 'Normal Sinus Rhythm' :
                   mlResult.label === 'af_suspected' ? 'AF Suspected' :
                   mlResult.label === 'other_rhythm' ? 'Other Rhythm' :
                   'Uncertain / Review'} (30s)
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Real ML Results / Insights (Both 10s Motion & 30s Rhythm) */}
            <div className="space-y-2.5">
              {/* Card 1: 10-Second Upload Packet Motion Result (Every upload) */}
              <div className="p-3 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-[#1a1a1a] rounded-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-1.5">
                    <Activity size={12} className="text-[#1B7A6E]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-light-text dark:text-[#F2F2F2]">
                      10s Upload Motion Result
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {motionResult?.motion_result?.research_only && (
                      <span className="text-[8px] font-mono px-1 py-0.2 bg-[#D99B3F]/10 text-[#D99B3F] border border-[#D99B3F]/20 rounded">
                        Research Use Only
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-light-text-secondary dark:text-[#9A9A9A]">
                      Every 10s packet
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-[#1a1a1a] text-xs">
                  <div>
                    <span className="text-[9px] text-light-text-secondary dark:text-[#9A9A9A] block uppercase font-mono">Posture / Verdict</span>
                    <span className="font-bold text-[#1B7A6E] capitalize text-xs">
                      {motionResult ? (
                        motionResult.motion_result?.verdict === 'supine' ? 'Supine' :
                        motionResult.motion_result?.verdict === 'upright_stationary' ? 'Upright Stationary' :
                        motionResult.motion_result?.verdict === 'walking' ? 'Walking' :
                        motionResult.motion_result?.verdict || motionResult.motion_result?.activity_level || 'Active'
                      ) : (
                        <span className="text-light-text-secondary dark:text-[#9A9A9A] font-normal italic">Awaiting packet...</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-light-text-secondary dark:text-[#9A9A9A] block uppercase font-mono">Model Score</span>
                    <span className="font-mono font-bold text-light-text dark:text-[#F2F2F2] text-xs">
                      {motionResult?.motion_result?.confidence !== undefined ? `${(motionResult.motion_result.confidence * 100).toFixed(0)}%` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-light-text-secondary dark:text-[#9A9A9A] block uppercase font-mono">Model Version</span>
                    <span className="font-mono text-light-text-secondary dark:text-[#9A9A9A] text-xs">
                      {motionResult?.motion_result?.model_version || (qrsData?.stats ? `${qrsData.stats.avgMotionMg} mg` : 'v1')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: 30-Second Continuous Rhythm Classification (Every 3 contiguous uploads) */}
              <div className="p-3 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-[#1a1a1a] rounded-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-1.5">
                    <Zap size={12} className="text-[#D99B3F]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-light-text dark:text-[#F2F2F2]">
                      30s Continuous Rhythm Classification
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-light-text-secondary dark:text-[#9A9A9A]">
                    3 contiguous uploads
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-[#1a1a1a]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-light-text-secondary dark:text-[#9A9A9A]">ECG Label:</span>
                    <span className="font-bold text-light-text dark:text-[#F2F2F2]">
                      {mlResult ? (
                        mlResult.label === 'normal' ? 'Normal Sinus Rhythm' :
                        mlResult.label === 'af_suspected' ? 'Atrial Fibrillation Suspected' :
                        mlResult.label === 'other_rhythm' ? 'Other Rhythm Abnormality' :
                        'Uncertain / Clinical Review'
                      ) : (
                        <span className="text-light-text-secondary dark:text-[#9A9A9A] font-normal italic flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D99B3F] animate-pulse inline-block" />
                          Awaiting 3 contiguous uploads (30s)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-light-text-secondary dark:text-[#9A9A9A]">Model Confidence:</span>
                    {mlResult ? (
                      <div className="text-right">
                        <span className="font-mono font-bold text-[#1B7A6E]">{(mlResult.confidence * 100).toFixed(1)}%</span>
                        <span className="text-[9px] text-light-text-secondary dark:text-[#9A9A9A] ml-1">(Model score)</span>
                      </div>
                    ) : (
                      <span className="font-mono text-light-text-secondary dark:text-[#9A9A9A]">—</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-light-text-secondary dark:text-[#9A9A9A]">Signal Quality:</span>
                    <span className="font-mono font-bold capitalize">
                      {mlResult ? (
                        mlResult.quality === 'usable' ? 'Usable Signal' : mlResult.quality === 'poor_signal' ? 'Poor Signal' : mlResult.quality
                      ) : (
                        <span className="font-mono text-light-text-secondary dark:text-[#9A9A9A] font-normal">Pending 30s analysis</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-light-text-secondary dark:text-[#9A9A9A]">Clinical Review:</span>
                    {mlResult ? (
                      <span className={`font-bold ${mlResult.requires_review ? 'text-[#D99B3F]' : 'text-[#1B7A6E]'}`}>
                        {mlResult.requires_review ? 'Required' : 'Standard'}
                      </span>
                    ) : (
                      <span className="text-light-text-secondary dark:text-[#9A9A9A] font-normal">—</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ML Chart 1 — ECG Rhythm History */}
        {mlAnalyses.length > 0 && (
          <div className="card-3d p-5 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] flex items-center">
                  <Activity size={13} className="mr-1.5 text-[#1B7A6E]" /> ECG Rhythm History
                </h3>
                <p className="text-[9px] text-light-text-secondary dark:text-[#555] mt-0.5">Bar height = model confidence · Color = classification label · Last {mlAnalyses.length} analyses</p>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#1B7A6E]" /> Normal</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#C4453D]" /> AF</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#D99B3F]" /> Other</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#9A9A9A]" /> Uncertain</span>
              </div>
            </div>
            <div className="h-[260px] bg-gray-50 dark:bg-[#0a0a0a] rounded-sm p-3 border border-gray-100 dark:border-[#1a1a1a]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={mlAnalyses.map((r, i) => ({
                    idx: i + 1,
                    confidence: Math.round((Number(r.confidence) || 0) * 100),
                    label: r.label || 'uncertain_review',
                    quality: r.quality || 'usable',
                    requires_review: r.requires_review,
                    time: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : `#${i+1}`,
                    fill: r.label === 'normal' ? '#1B7A6E' : r.label === 'af_suspected' ? '#C4453D' : r.label === 'other_rhythm' ? '#D99B3F' : '#9A9A9A',
                  }))}
                  margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="rhythmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B7A6E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1B7A6E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" opacity={0.4} />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9A9A9A' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9A9A9A' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', fontSize: '10px', color: '#F2F2F2', borderRadius: '4px' }}
                    formatter={(val: any, _: any, props: any) => {
                      const { label, quality, requires_review } = props.payload;
                      const labelStr = label === 'normal' ? 'Normal Sinus' : label === 'af_suspected' ? 'AF Suspected' : label === 'other_rhythm' ? 'Other Rhythm' : 'Uncertain / Review';
                      return [
                        <span key="v">{val}% confidence — <b>{labelStr}</b><br />Quality: {quality === 'poor_signal' ? '⚠ Poor Signal' : '✓ Usable'}{requires_review ? ' · Review Required' : ''}</span>,
                        ''
                      ];
                    }}
                    labelFormatter={l => `Session: ${l}`}
                  />
                  <Area type="monotone" dataKey="confidence" stroke="#1B7A6E" strokeWidth={1.5} fill="url(#rhythmGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Bar grid below showing label color per session */}
            <div className="mt-3 flex items-end gap-1 h-10 px-1">
              {mlAnalyses.map((r, i) => {
                const conf = Number(r.confidence) || 0;
                const color = r.label === 'normal' ? '#1B7A6E' : r.label === 'af_suspected' ? '#C4453D' : r.label === 'other_rhythm' ? '#D99B3F' : '#9A9A9A';
                const heightPct = Math.max(15, Math.round(conf * 100));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${r.label} · ${Math.round(conf * 100)}% · ${r.quality}`}>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{ height: `${heightPct}%`, backgroundColor: color, opacity: 0.3 + conf * 0.7 }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[8px] text-[#9A9A9A] mt-0.5 px-1">
              <span>Oldest</span>
              <span className="text-[#555] text-center">↑ confidence · color = label</span>
              <span>Latest</span>
            </div>
          </div>
        )}

        {/* ML Chart 2 — Posture Timeline */}
        {motionHistory.length > 0 && (
          <div className="card-3d p-5 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] flex items-center">
                  <Activity size={13} className="mr-1.5 text-[#D99B3F]" /> Posture Timeline
                </h3>
                <p className="text-[9px] text-light-text-secondary dark:text-[#555] mt-0.5">Opacity = motion model confidence · Color = posture verdict · Last {motionHistory.length} uploads</p>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#1B7A6E]" /> Supine</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#D99B3F]" /> Upright</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#C4453D]" /> Walking</span>
              </div>
            </div>
            <div className="h-[140px] bg-gray-50 dark:bg-[#0a0a0a] rounded-sm p-3 border border-gray-100 dark:border-[#1a1a1a] flex items-center">
              <div className="flex w-full h-12 gap-0.5">
                {motionHistory.map((r, i) => {
                  const m = r.motion_result || {};
                  const verdict = m.verdict || 'unknown';
                  const conf = Number(m.confidence) || 0.5;
                  const color = verdict === 'supine' ? '#1B7A6E' : verdict === 'upright_stationary' ? '#D99B3F' : verdict === 'walking' ? '#C4453D' : '#9A9A9A';
                  const label = verdict === 'supine' ? 'Supine' : verdict === 'upright_stationary' ? 'Upright' : verdict === 'walking' ? 'Walking' : verdict;
                  const timeStr = r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : `#${i+1}`;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm cursor-default transition-opacity hover:opacity-100 relative group"
                      style={{ backgroundColor: color, opacity: 0.2 + conf * 0.8 }}
                      title={`${label} · ${Math.round(conf * 100)}% confidence · ${timeStr}`}
                    >
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10">
                        <div className="bg-[#0a0a0a] border border-[#262626] rounded px-1.5 py-0.5 text-[8px] text-[#F2F2F2] whitespace-nowrap">
                          {label} · {Math.round(conf * 100)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between text-[8px] text-[#9A9A9A] mt-2 px-1">
              <span>Oldest upload</span>
              <span>Latest upload</span>
            </div>
          </div>
        )}

        {/* ML Chart 3 — Signal Quality Ratio */}
        {mlAnalyses.length > 0 && (() => {
          const usable = mlAnalyses.filter(r => r.quality === 'usable').length;
          const poor = mlAnalyses.length - usable;
          const pct = Math.round((usable / mlAnalyses.length) * 100);
          const radius = 36;
          const circ = 2 * Math.PI * radius;
          const usableArc = (usable / mlAnalyses.length) * circ;
          return (
            <div className="card-3d p-5 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-4 flex items-center">
                <Activity size={13} className="mr-1.5 text-[#1B7A6E]" /> Signal Quality Ratio
              </h3>
              <div className="flex items-center gap-8">
                {/* SVG Donut */}
                <div className="relative flex-none">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r={radius} fill="none" stroke="#C4453D" strokeWidth="12" />
                    <circle
                      cx="48" cy="48" r={radius} fill="none"
                      stroke="#1B7A6E" strokeWidth="12"
                      strokeDasharray={`${usableArc} ${circ}`}
                      strokeDashoffset={circ / 4}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-light-text dark:text-[#F2F2F2]">{pct}%</span>
                    <span className="text-[8px] uppercase tracking-widest text-[#9A9A9A]">usable</span>
                  </div>
                </div>
                {/* Stats */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#1B7A6E]" />
                    <span className="text-xs font-bold text-light-text dark:text-[#F2F2F2]">{usable} usable</span>
                    <span className="text-[9px] text-[#9A9A9A]">sessions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#C4453D]" />
                    <span className="text-xs font-bold text-light-text dark:text-[#F2F2F2]">{poor} poor signal</span>
                    <span className="text-[9px] text-[#9A9A9A]">sessions</span>
                  </div>
                  {poor > usable && (
                    <div className="mt-1 text-[9px] text-[#C4453D] font-mono bg-[#C4453D]/5 border border-[#C4453D]/20 rounded px-2 py-1">
                      ⚠ Most sessions have poor signal — check device placement
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 4. Recent Alarms Timeline */}
        <div className="card-3d p-3.5 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-2 flex items-center">
            <AlertTriangle size={13} className="mr-1.5 text-[#C4453D]" /> Recent Alarm History
          </h3>
          {isLoadingAlarms ? (
            <div className="py-4 text-center text-xs text-light-text-secondary dark:text-[#9A9A9A]">
              Loading alarm history...
            </div>
          ) : alarms.length === 0 ? (
            <div className="py-2 text-xs text-light-text-secondary dark:text-[#9A9A9A]">
              No active or recorded alarms for this device.
            </div>
          ) : (
            <div className="relative pl-3 space-y-3 before:absolute before:inset-y-0 before:left-[5px] before:w-[2px] before:bg-gray-100 dark:before:bg-[#262626]">
              {alarms.slice(0, 5).map((alarm, i) => {
                const color = alarm.severity === 'critical' ? 'bg-[#C4453D]' : alarm.severity === 'warning' ? 'bg-[#D99B3F]' : 'bg-[#1B7A6E]';
                const timeStr = alarm.created_at
                  ? new Date(alarm.created_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'UTC',
                  })
                  : 'Recent';
                const desc = alarm.payload?.description || `${alarm.event_type} (${alarm.subtype})`;
                return (
                  <div key={alarm.id || i} className="relative pl-4">
                    <div className={`absolute left-[-4px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#121212] ${color}`} />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{timeStr}</span>
                        <span className={`text-[8px] uppercase tracking-widest px-1 py-0.2 rounded font-mono ${alarm.severity === 'warning' ? 'text-[#D99B3F] bg-[#D99B3F]/10' : 'text-[#1B7A6E] bg-[#1B7A6E]/10'
                          }`}>
                          {alarm.severity || alarm.subtype}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-light-text dark:text-[#F2F2F2] mt-0.5">{desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Usage & Compliance */}
        <div className="card-3d p-3.5 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-2 flex items-center">
            <CheckSquare size={13} className="mr-1.5 text-[#1B7A6E]" /> Usage & Compliance
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-light-text dark:text-[#F2F2F2]">
                {device.connectivityStatus === 'Online' ? '100%' : '98.5%'}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mt-0.5">Total Uptime</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-light-text dark:text-[#F2F2F2]">
                {qrsData?.stats ? qrsData.stats.totalSamples.toLocaleString() : '100%'}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mt-0.5">Samples Received</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-light-text dark:text-[#F2F2F2]">
                {qrsData?.stats.durationSec ? `${qrsData.stats.durationSec}s` : '10s'}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mt-0.5">Active Batch Duration</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-light-text dark:text-[#F2F2F2]">
                {alarms.filter(a => a.status === 'unacknowledged').length}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mt-0.5">Pending Alarms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---
export default function DevicesPage({
  userRole = 'administrator',
  devices = [],
  isLoading = false,
  getDeviceDetail = defaultGetDeviceDetail,
  onManageCommands = () => { },
  onExportReadings = (deviceId: string, detailData: any) => { },
  onClearFilters = () => { },
  initialSelectedDeviceId = null,
  onViewTelemetry
}: DevicesPageProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(initialSelectedDeviceId);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [firmwareFilter, setFirmwareFilter] = useState('All Firmware');
  const [isDbDrawerOpen, setIsDbDrawerOpen] = useState(false);

  // Bulk Selection
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedDeviceId(initialSelectedDeviceId);
  }, [initialSelectedDeviceId]);

  useEffect(() => {
    if (selectedDeviceId) {
      setIsDetailLoading(true);
      getDeviceDetail(selectedDeviceId).then(data => {
        setDetailData(data);
        setIsDetailLoading(false);
      });
    } else {
      setDetailData(null);
    }
  }, [selectedDeviceId, getDeviceDetail]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setFirmwareFilter('All Firmware');
    onClearFilters();
  };

  const filteredDevices = useMemo(() => devices.filter(d => {
    if (statusFilter !== 'All') {
      if (statusFilter === 'Online' && d.connectivityStatus !== 'Online') return false;
      if (statusFilter === 'Offline' && d.connectivityStatus !== 'Offline') return false;
      if (statusFilter === 'Needs Update' && !d.firmwareUpdateAvailable) return false;
    }
    if (firmwareFilter !== 'All Firmware') {
      if (d.firmwareVersion !== firmwareFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return d.id.toLowerCase().includes(q) ||
        (d.serialNumber || '').toLowerCase().includes(q) ||
        (d.ownerName || '').toLowerCase().includes(q);
    }
    return true;
  }), [devices, statusFilter, firmwareFilter, searchQuery]);

  const uniqueFirmwares = Array.from(new Set(devices.map(d => d.firmwareVersion))).filter(Boolean);

  const toggleSelectAll = () => {
    if (selectedDeviceIds.size === filteredDevices.length) {
      setSelectedDeviceIds(new Set());
    } else {
      setSelectedDeviceIds(new Set(filteredDevices.map(d => d.id)));
    }
  };

  const toggleSelectDevice = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(selectedDeviceIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDeviceIds(next);
  };

  // --- FULL PAGE DATABASE EXPLORER ---
  if (isDbDrawerOpen) {
    return (
      <DeviceDatabaseTables
        devices={devices}
        selectedDeviceId={selectedDeviceId || devices[0]?.id}
        onSelectDevice={(id) => setSelectedDeviceId(id)}
        onClose={() => setIsDbDrawerOpen(false)}
      />
    );
  }

  // --- RENDER LIST VIEW ---
  if (!selectedDeviceId) {
    return (
      <div className="h-full flex flex-col bg-light-bg dark:bg-[#000000] text-light-text dark:text-[#F2F2F2] overflow-hidden relative">

        {/* Header & Filter Bar */}
        <div className="flex-none px-6 md:px-8 py-3.5 border-b border-gray-200 dark:border-[#262626] space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold uppercase tracking-tight">Device Fleet</h1>
              <p className="text-[11px] text-light-text-secondary dark:text-[#9A9A9A]">Manage and monitor active devices.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDbDrawerOpen(true)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-widest bg-[#1B7A6E] hover:bg-[#145F56] px-2.5 py-1 rounded-sm shadow-sm transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#1B7A6E]"
                title="Open Database Tables side drawer"
              >
                <Database size={12} /> DB Tables
              </button>
              <div className="text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-widest bg-gray-100 dark:bg-[#1a1a1a] px-2.5 py-1 rounded-sm border border-gray-200 dark:border-[#333]">
                Total: {devices.length} Devices
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#666]" size={13} />
              <input
                type="text"
                placeholder="Search by ID, Serial, or Owner..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] transition-all"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] cursor-pointer min-w-[120px]"
              >
                <option value="All">All Status</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Needs Update">Needs Update</option>
              </select>

              <select
                value={firmwareFilter}
                onChange={e => setFirmwareFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] cursor-pointer hidden sm:block min-w-[120px]"
              >
                <option value="All Firmware">All Firmware</option>
                {uniqueFirmwares.map(fw => <option key={fw as string} value={fw as string}>{fw as string}</option>)}
              </select>

              {(searchQuery || statusFilter !== 'All' || firmwareFilter !== 'All Firmware') && (
                <button
                  onClick={handleClearFilters}
                  className="px-2.5 py-1.5 text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-widest hover:text-[#1B7A6E] dark:hover:text-[#1B7A6E] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#1B7A6E] whitespace-nowrap cursor-pointer flex items-center"
                >
                  <X size={12} className="mr-1" /> Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Device Table / List */}
        <div className="flex-1 overflow-auto p-4 md:p-6 pb-20">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm animate-pulse"></div>
              ))}
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              {devices.length === 0 ? (
                <>
                  <div className="w-16 h-16 bg-[#1B7A6E]/10 rounded-full flex items-center justify-center mb-4">
                    <Smartphone size={28} className="text-[#1B7A6E]" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No devices yet</h3>
                  <p className="text-sm text-light-text-secondary dark:text-[#9A9A9A] max-w-sm mb-6">
                    Connect your first ECG monitoring device to start tracking metrics and alarms.
                  </p>
                  <button className="px-6 py-2.5 bg-[#1B7A6E] text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-[#145F56] transition-colors shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B7A6E]">
                    Add First Device
                  </button>
                </>
              ) : (
                <>
                  <Filter className="text-gray-300 dark:text-[#333] mb-4" size={48} />
                  <h3 className="text-lg font-bold mb-2">No devices match filters</h3>
                  <p className="text-sm text-light-text-secondary dark:text-[#9A9A9A] max-w-sm mb-6">
                    Try adjusting your search query or changing the filter options to see more results.
                  </p>
                  <button onClick={handleClearFilters} className="px-6 py-2.5 bg-gray-100 dark:bg-[#121212] border border-gray-200 dark:border-[#333] text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-gray-200 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]">
                    Clear All Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="border-b border-gray-200 dark:border-[#262626] text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-widest">
                    <tr>
                      <th className="px-3 py-2.5 w-12 text-center">
                        <button onClick={toggleSelectAll} className="outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          {selectedDeviceIds.size === filteredDevices.length && filteredDevices.length > 0 ? <CheckSquare size={16} className="text-[#1B7A6E]" /> : <Square size={16} />}
                        </button>
                      </th>
                      <th className="px-4 py-2.5">Device ID</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Motion / Quality (ML)</th>
                      <th className="px-4 py-2.5 hidden md:table-cell">Signal (7d)</th>
                      <th className="px-4 py-2.5 hidden lg:table-cell">Firmware</th>
                      <th className="px-4 py-2.5">Last Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1a1a1a]">
                    {filteredDevices.map(device => {
                      const isSelected = selectedDeviceIds.has(device.id);
                      const isOffline = device.connectivityStatus === 'Offline';

                      let rowBg = 'hover:bg-gray-50 dark:hover:bg-[#1a1a1a]';
                      if (isSelected) rowBg = 'bg-[#1B7A6E]/5 hover:bg-[#1B7A6E]/10';
                      else if (isOffline) rowBg = 'bg-[#C4453D]/5 hover:bg-[#C4453D]/10';

                      // Mock sparkline data based on motion / signal
                      const motionSpark = Array.from({ length: 10 }, (_, i) => 980 + Math.sin(i) * 20);
                      const sigSpark = Array.from({ length: 10 }, (_, i) => (device.signalStrength * 25) + (Math.random() * 20 - 10));

                      return (
                        <tr
                          key={device.id}
                          onClick={() => setSelectedDeviceId(device.id)}
                          tabIndex={0}
                          className={`transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1B7A6E] ${rowBg} ${isOffline ? 'border-l-4 border-l-[#C4453D]' : 'border-l-4 border-l-transparent'}`}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={(e) => toggleSelectDevice(e, device.id)}
                              className="outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              {isSelected ? <CheckSquare size={16} className="text-[#1B7A6E]" /> : <Square size={16} />}
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-bold text-light-text dark:text-[#F2F2F2] flex items-center gap-2 text-xs">
                              {device.id}
                              {isOffline && <AlertTriangle size={12} className="text-[#C4453D]" />}
                            </div>
                            <div className="text-[11px] text-light-text-secondary dark:text-[#9A9A9A]">
                              {device.ownerName || <span className="italic opacity-50">Unassigned</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge isOnline={!isOffline} />
                          </td>
                          <td className="px-4 py-2.5">
                            <MotionQualityIndicator quality="Active" sparkData={motionSpark} />
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <SignalIndicator strength={device.signalStrength} sparkData={sigSpark} />
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono">{device.firmwareVersion}</span>
                              {device.firmwareUpdateAvailable && (
                                <span className="text-[9px] font-bold uppercase tracking-widest bg-[#D99B3F]/10 text-[#D99B3F] px-1.5 py-0.5 rounded-sm">Update</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-light-text-secondary dark:text-[#9A9A9A]">
                            {device.lastSync}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Action Toolbar */}
        <AnimatePresence>
          {selectedDeviceIds.size > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-40"
            >
              <div className="text-sm font-bold text-[#1B7A6E]">
                {selectedDeviceIds.size} Selected
              </div>
              <div className="h-4 w-px bg-gray-200 dark:bg-[#333]" />
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
                >
                  <RefreshCw size={14} /> Restart
                </button>
                <button
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#D99B3F] hover:bg-[#D99B3F]/10 rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#D99B3F]"
                >
                  <Download size={14} /> Push Firmware
                </button>
                <button
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
                >
                  <Zap size={14} /> Ping
                </button>
              </div>
              <button onClick={() => setSelectedDeviceIds(new Set())} className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-[#F2F2F2]">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- RENDER DETAIL VIEW ---
  const device = devices.find(d => d.id === selectedDeviceId) || devices[0];

  if (!device) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-light-bg dark:bg-[#000000] text-light-text-secondary dark:text-[#9A9A9A]">
        <div className="w-8 h-8 border-2 border-[#1B7A6E]/30 border-t-[#1B7A6E] rounded-full animate-spin mb-4"></div>
        <p className="text-sm">Loading device details...</p>
        <button
          onClick={() => setSelectedDeviceId(null)}
          className="mt-4 text-xs font-bold uppercase tracking-widest text-[#1B7A6E] hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-light-bg dark:bg-[#000000] text-light-text dark:text-[#F2F2F2] overflow-hidden">

      {/* Compact Detail Header */}
      <div className="flex-none px-4 py-2.5 border-b border-gray-200 dark:border-[#262626] bg-light-card dark:bg-[#121212] sticky top-0 z-10">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSelectedDeviceId(null)}
              className="flex items-center text-[11px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] dark:hover:text-[#1B7A6E] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm py-1 px-1.5 cursor-pointer"
            >
              <ArrowLeft size={13} className="mr-1" /> Back
            </button>
            <div className="h-4 w-px bg-gray-200 dark:bg-[#333]" />
            <h1 className="text-base font-bold tracking-tight text-light-text dark:text-[#F2F2F2]">{device.id}</h1>
            <StatusBadge isOnline={device.connectivityStatus === 'Online'} />
            <div className="hidden sm:flex items-center gap-3 text-xs text-light-text-secondary dark:text-[#9A9A9A] ml-2">
              <span className="flex items-center font-mono text-[11px]"><Hash size={11} className="mr-1 opacity-70" />{device.serialNumber}</span>
              <span className="flex items-center text-[11px]"><User size={11} className="mr-1 opacity-70" />{device.ownerName || 'Unassigned'}</span>
              <span className="flex items-center text-[11px]"><Clock size={11} className="mr-1 opacity-70" />Sync: {device.lastSync}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDbDrawerOpen(true)}
              className="px-3 py-1.5 bg-[#1B7A6E] hover:bg-[#145F56] text-white rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer shadow-sm flex items-center gap-1.5"
              title="Open Database Tables side drawer"
            >
              <Database size={12} /> DB Tables
            </button>
            {onViewTelemetry && (
              <button
                onClick={() => onViewTelemetry(device.id)}
                className="px-3 py-1.5 bg-[#1B7A6E] hover:bg-[#145F56] text-white rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer shadow-sm flex items-center gap-1.5"
                title="View Telemetry Data & Analysis"
              >
                <Activity size={12} /> Telemetry
              </button>
            )}
            <button
              onClick={() => onManageCommands(device.id)}
              className="px-3 py-1.5 bg-[#1B7A6E] hover:bg-[#145F56] text-white rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer shadow-sm flex items-center gap-1.5"
              title="Open Device Command Interface"
            >
              <Zap size={12} /> Command
            </button>
          </div>
        </div>
      </div>

      {/* Detail Content Area (Device Analysis Section) */}
      <DeviceAnalysisSection device={device} />
    </div>
  );
}
