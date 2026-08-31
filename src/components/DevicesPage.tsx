import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Filter, X, Signal, SignalZero, SignalLow, SignalMedium, SignalHigh,
  Battery, AlertTriangle, ArrowLeft, Download, Clock, User, Hash, HardDrive, Wifi, WifiOff, FileText, ChevronLeft, ChevronRight, CheckSquare, Square, Zap, RefreshCw, Smartphone, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart
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

const BatteryIndicator = ({ level, sparkData }: { level: number, sparkData?: number[] }) => {
  let color = 'text-[#1B7A6E]';
  let hexColor = '#1B7A6E';
  if (level <= 20) { color = 'text-[#C4453D]'; hexColor = '#C4453D'; }
  else if (level <= 50) { color = 'text-[#D99B3F]'; hexColor = '#D99B3F'; }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center space-x-1.5 w-14">
        <div className={`w-6 h-3 border border-current rounded-[2px] p-[1px] relative ${color}`}>
          <div className="h-full bg-current" style={{ width: `${level}%` }}></div>
          <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[1px] h-1.5 bg-current rounded-r-sm"></div>
        </div>
        <span className={`text-xs font-semibold ${color}`}>{level}%</span>
      </div>
      {sparkData && <Sparkline data={sparkData} color={hexColor} />}
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
        timestamp: new Date(r.time).toLocaleString(),
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
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'custom'>('7d');
  const [customDate, setCustomDate] = useState('');

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-12">
      {/* Time Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-[#262626] pb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest flex items-center">
          <Activity size={18} className="mr-2 text-[#1B7A6E]" /> Device Analytics
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mr-2">Range:</span>
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors ${timeRange === '7d' ? 'bg-[#1B7A6E] text-white' : 'bg-gray-100 dark:bg-[#1a1a1a] text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-200 dark:hover:bg-[#262626]'}`}
          >7 Days</button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors ${timeRange === '30d' ? 'bg-[#1B7A6E] text-white' : 'bg-gray-100 dark:bg-[#1a1a1a] text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-200 dark:hover:bg-[#262626]'}`}
          >30 Days</button>
          <button
            onClick={() => setTimeRange('custom')}
            className={`px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors ${timeRange === 'custom' ? 'bg-[#1B7A6E] text-white' : 'bg-gray-100 dark:bg-[#1a1a1a] text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-200 dark:hover:bg-[#262626]'}`}
          >Custom</button>

          {timeRange === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="ml-2 px-2 py-1.5 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-[10px] uppercase tracking-widest outline-none focus:ring-1 focus:ring-[#1B7A6E]"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-10">

        {/* 1. QRS vs. Motion Artifacts */}
        <div className="card-3d p-6 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-4 flex items-center">
            <Activity size={14} className="mr-2 text-[#22c55e]" /> QRS Complex vs. Motion Artifacts
          </h3>
          <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] mb-6">
            Detailed analysis showing how physical motion (accelerometer magnitude) affects the raw ECG signal quality.
          </p>
          <div className="h-64 bg-gray-50 dark:bg-[#0a0a0a] rounded-sm p-2 border border-gray-100 dark:border-[#1a1a1a]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={[
                  { time: '0ms', ecg: 0.0, motion: 0.1 },
                  { time: '100ms', ecg: 0.1, motion: 0.2 },
                  { time: '200ms', ecg: 0.0, motion: 0.1 },
                  { time: '300ms', ecg: -0.2, motion: 0.1 },
                  { time: '350ms', ecg: 1.5, motion: 0.1 },
                  { time: '400ms', ecg: -0.4, motion: 0.2 },
                  { time: '500ms', ecg: 0.2, motion: 0.1 },
                  { time: '600ms', ecg: 0.1, motion: 0.1 },
                  { time: '700ms', ecg: 0.0, motion: 0.1 },
                  { time: '800ms', ecg: 0.5, motion: 1.5 },
                  { time: '900ms', ecg: -0.8, motion: 2.2 },
                  { time: '1000ms', ecg: 1.2, motion: 1.8 },
                  { time: '1100ms', ecg: -0.6, motion: 1.2 },
                  { time: '1200ms', ecg: 0.4, motion: 0.5 },
                  { time: '1300ms', ecg: 0.0, motion: 0.2 },
                ]}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9A9A9A' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" domain={[-1.5, 2]} tick={{ fontSize: 9, fill: '#22c55e' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 3]} tick={{ fontSize: 9, fill: '#C4453D' }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#121212', borderColor: '#262626', fontSize: '11px', color: '#F2F2F2' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area yAxisId="right" type="step" dataKey="motion" name="Motion Mag (g)" fill="#C4453D" fillOpacity={0.2} stroke="#C4453D" strokeWidth={1} />
                <Line yAxisId="left" type="monotone" dataKey="ecg" name="ECG Lead I (mV)" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Performance Trends */}
        <div className="card-3d p-6 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-6 flex items-center">
            <Activity size={14} className="mr-2 text-[#1B7A6E]" /> Performance Trends
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Signal Stability</span>
                <span className="text-sm font-bold text-[#1B7A6E]">94%</span>
              </div>
              <div className="h-48 bg-gray-50 dark:bg-[#0a0a0a] rounded-sm p-1 border border-gray-100 dark:border-[#1a1a1a]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { time: 'Day 1', val: 80 }, { time: 'Day 2', val: 85 }, { time: 'Day 3', val: 90 },
                    { time: 'Day 4', val: 85 }, { time: 'Day 5', val: 95 }, { time: 'Day 6', val: 100 },
                    { time: 'Day 7', val: 94 }
                  ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSignal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1B7A6E" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#1B7A6E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9A9A9A' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9A9A9A' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#121212', borderColor: '#262626', fontSize: '10px', color: '#F2F2F2', padding: '4px 8px' }}
                      itemStyle={{ color: '#1B7A6E', fontWeight: 'bold' }}
                      labelStyle={{ display: 'none' }}
                      formatter={(val: number) => [`${val}%`, 'Signal']}
                    />
                    <Area type="monotone" dataKey="val" stroke="#1B7A6E" strokeWidth={2} fillOpacity={1} fill="url(#colorSignal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Battery Level</span>
                <span className="text-sm font-bold text-[#D99B3F]">-15% / day</span>
              </div>
              <div className="h-48 bg-gray-50 dark:bg-[#0a0a0a] rounded-sm p-1 border border-gray-100 dark:border-[#1a1a1a]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { time: 'Day 1', val: 100 }, { time: 'Day 2', val: 85 }, { time: 'Day 3', val: 70 },
                    { time: 'Day 4', val: 55 }, { time: 'Day 5', val: 100 }, { time: 'Day 6', val: 80 },
                    { time: 'Day 7', val: 65 }
                  ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBatt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D99B3F" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#D99B3F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9A9A9A' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9A9A9A' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#121212', borderColor: '#262626', fontSize: '10px', color: '#F2F2F2', padding: '4px 8px' }}
                      itemStyle={{ color: '#D99B3F', fontWeight: 'bold' }}
                      labelStyle={{ display: 'none' }}
                      formatter={(val: number) => [`${val}%`, 'Battery']}
                    />
                    <Area type="stepAfter" dataKey="val" stroke="#D99B3F" strokeWidth={2} fillOpacity={1} fill="url(#colorBatt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* 3. AI Health Insights (Graphical) */}
        <div className="card-3d p-6 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-4 flex items-center">
            <Zap size={14} className="mr-2 text-[#D99B3F]" /> Pulse AI Health Insights
          </h3>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* Graphical Radar Chart */}
            <div className="w-full md:w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius="70%" data={[
                  { subject: 'Battery Efficiency', A: 65, fullMark: 100 },
                  { subject: 'Signal Stability', A: 94, fullMark: 100 },
                  { subject: 'Data Quality', A: 99, fullMark: 100 },
                  { subject: 'Sensor Health', A: 100, fullMark: 100 },
                  { subject: 'Sync Reliability', A: 98, fullMark: 100 },
                ]}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9A9A9A', fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Device Health" dataKey="A" stroke="#1B7A6E" fill="#1B7A6E" fillOpacity={0.3} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#121212', borderColor: '#262626', fontSize: '11px', color: '#F2F2F2' }}
                    itemStyle={{ color: '#1B7A6E', fontWeight: 'bold' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Text Insights */}
            <div className="w-full md:w-1/2 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-[#D99B3F]/5 border border-[#D99B3F]/20 rounded-sm">
                <div className="mt-1 w-2 h-2 rounded-full bg-[#D99B3F] shrink-0" />
                <p className="text-xs text-light-text dark:text-[#F2F2F2]">Battery efficiency is 35% lower than the fleet average. Check for high-frequency data transmission.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-[#1a1a1a] rounded-sm">
                <div className="mt-1 w-2 h-2 rounded-full bg-[#1B7A6E] shrink-0" />
                <p className="text-xs text-light-text dark:text-[#F2F2F2]">Signal strength remains stable (avg 94%) during typical usage hours.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-[#1a1a1a] rounded-sm">
                <div className="mt-1 w-2 h-2 rounded-full bg-[#1B7A6E] shrink-0" />
                <p className="text-xs text-light-text dark:text-[#F2F2F2]">Sensor data quality and sync reliability are performing optimally.</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Recent Alarms Timeline */}
        <div className="card-3d p-6 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-4 flex items-center">
            <AlertTriangle size={14} className="mr-2 text-[#C4453D]" /> Recent Alarm History
          </h3>
          <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[7px] before:w-[2px] before:bg-gray-100 dark:before:bg-[#262626]">
            {[
              { time: '2 hours ago', type: 'Critical', desc: 'Device disconnected unexpectedly', color: 'bg-[#C4453D]' },
              { time: '1 day ago', type: 'Warning', desc: 'Low battery threshold reached (20%)', color: 'bg-[#D99B3F]' },
              { time: '3 days ago', type: 'Info', desc: 'Firmware updated successfully to v4.2.1', color: 'bg-[#1B7A6E]' },
            ].map((alarm, i) => (
              <div key={i} className="relative pl-6">
                <div className={`absolute left-[-5px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-[#121212] ${alarm.color}`} />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{alarm.time}</span>
                  <span className="text-xs font-semibold text-light-text dark:text-[#F2F2F2] mt-0.5">{alarm.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Usage & Compliance */}
        <div className="card-3d p-6 bg-white dark:bg-[#121212] rounded-sm border border-gray-100 dark:border-[#262626]">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-4 flex items-center">
            <CheckSquare size={14} className="mr-2 text-[#1B7A6E]" /> Usage & Compliance
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-light-text dark:text-[#F2F2F2]">99.8%</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mt-1">Total Uptime</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-light-text dark:text-[#F2F2F2]">98.5%</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mt-1">Data Delivered</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-light-text dark:text-[#F2F2F2]">14<span className="text-sm text-[#9A9A9A]">d</span></span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mt-1">Avg Session Length</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-light-text dark:text-[#F2F2F2]">0</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mt-1">Missed Syncs</span>
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
      if (statusFilter === 'Low Battery' && d.batteryLevel > 20) return false;
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

  // --- RENDER LIST VIEW ---
  if (!selectedDeviceId) {
    return (
      <div className="h-full flex flex-col bg-light-bg dark:bg-[#000000] text-light-text dark:text-[#F2F2F2] overflow-hidden relative">

        {/* Header & Filter Bar */}
        <div className="flex-none px-8 md:px-12 py-6 border-b border-gray-200 dark:border-[#262626] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight">Device Fleet</h1>
              <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] mt-0.5">Manage and monitor active devices.</p>
            </div>
            <div className="text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-widest bg-gray-100 dark:bg-[#1a1a1a] px-3 py-1.5 rounded-sm border border-gray-200 dark:border-[#333]">
              Total: {devices.length} Devices
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#666]" size={14} />
              <input
                type="text"
                placeholder="Search by ID, Serial, or Owner..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] transition-all"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] cursor-pointer min-w-[130px]"
              >
                <option value="All">All Status</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Low Battery">Low Battery</option>
                <option value="Needs Update">Needs Update</option>
              </select>

              <select
                value={firmwareFilter}
                onChange={e => setFirmwareFilter(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] cursor-pointer hidden sm:block min-w-[130px]"
              >
                <option value="All Firmware">All Firmware</option>
                {uniqueFirmwares.map(fw => <option key={fw as string} value={fw as string}>{fw as string}</option>)}
              </select>

              {(searchQuery || statusFilter !== 'All' || firmwareFilter !== 'All Firmware') && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-widest hover:text-[#1B7A6E] dark:hover:text-[#1B7A6E] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#1B7A6E] whitespace-nowrap cursor-pointer flex items-center"
                >
                  <X size={12} className="mr-1" /> Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Device Table / List */}
        <div className="flex-1 overflow-auto p-6 md:p-10 pb-24">
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
                      <th className="px-4 py-5 w-12 text-center">
                        <button onClick={toggleSelectAll} className="outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          {selectedDeviceIds.size === filteredDevices.length && filteredDevices.length > 0 ? <CheckSquare size={16} className="text-[#1B7A6E]" /> : <Square size={16} />}
                        </button>
                      </th>
                      <th className="px-6 py-5">Device ID</th>
                      <th className="px-6 py-5">Status</th>
                      <th className="px-6 py-5">Battery (7d)</th>
                      <th className="px-6 py-5 hidden md:table-cell">Signal (7d)</th>
                      <th className="px-6 py-5 hidden lg:table-cell">Firmware</th>
                      <th className="px-6 py-5">Last Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1a1a1a]">
                    {filteredDevices.map(device => {
                      const isSelected = selectedDeviceIds.has(device.id);
                      const isOffline = device.connectivityStatus === 'Offline';
                      const isLowBatt = device.batteryLevel <= 20;

                      let rowBg = 'hover:bg-gray-50 dark:hover:bg-[#1a1a1a]';
                      if (isSelected) rowBg = 'bg-[#1B7A6E]/5 hover:bg-[#1B7A6E]/10';
                      else if (isOffline) rowBg = 'bg-[#C4453D]/5 hover:bg-[#C4453D]/10';
                      else if (isLowBatt) rowBg = 'bg-[#D99B3F]/5 hover:bg-[#D99B3F]/10';

                      // Mock sparkline data based on battery/signal
                      const battSpark = Array.from({ length: 10 }, (_, i) => device.batteryLevel + Math.sin(i) * 5 + (i * 2));
                      const sigSpark = Array.from({ length: 10 }, (_, i) => (device.signalStrength * 25) + (Math.random() * 20 - 10));

                      return (
                        <tr
                          key={device.id}
                          onClick={() => setSelectedDeviceId(device.id)}
                          tabIndex={0}
                          className={`transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1B7A6E] ${rowBg} ${isOffline ? 'border-l-4 border-l-[#C4453D]' : isLowBatt ? 'border-l-4 border-l-[#D99B3F]' : 'border-l-4 border-l-transparent'}`}
                        >
                          <td className="px-4 py-5 text-center">
                            <button
                              onClick={(e) => toggleSelectDevice(e, device.id)}
                              className="outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              {isSelected ? <CheckSquare size={16} className="text-[#1B7A6E]" /> : <Square size={16} />}
                            </button>
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-bold text-light-text dark:text-[#F2F2F2] flex items-center gap-2">
                              {device.id}
                              {isOffline && <AlertTriangle size={12} className="text-[#C4453D]" />}
                            </div>
                            <div className="text-xs text-light-text-secondary dark:text-[#9A9A9A] mt-0.5">
                              {device.ownerName || <span className="italic opacity-50">Unassigned</span>}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <StatusBadge isOnline={!isOffline} />
                          </td>
                          <td className="px-6 py-5">
                            <BatteryIndicator level={device.batteryLevel} sparkData={battSpark} />
                          </td>
                          <td className="px-6 py-5 hidden md:table-cell">
                            <SignalIndicator strength={device.signalStrength} sparkData={sigSpark} />
                          </td>
                          <td className="px-6 py-5 hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono">{device.firmwareVersion}</span>
                              {device.firmwareUpdateAvailable && (
                                <span className="text-[9px] font-bold uppercase tracking-widest bg-[#D99B3F]/10 text-[#D99B3F] px-1.5 py-0.5 rounded-sm">Update</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-xs text-light-text-secondary dark:text-[#9A9A9A]">
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

      {/* Detail Header */}
      <div className="flex-none p-6 border-b border-gray-200 dark:border-[#262626] bg-light-card dark:bg-[#121212] sticky top-0 z-10">
        <button
          onClick={() => setSelectedDeviceId(null)}
          className="flex items-center text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] dark:hover:text-[#1B7A6E] transition-colors mb-6 outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm py-1 px-2 -ml-2 cursor-pointer"
        >
          <ArrowLeft size={16} className="mr-2" /> Back to Devices
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tracking-tight">{device.id}</h1>
              <StatusBadge isOnline={device.connectivityStatus === 'Online'} />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-light-text-secondary dark:text-[#9A9A9A]">
              <div className="flex items-center">
                <Hash size={14} className="mr-1.5" />
                {device.serialNumber}
              </div>
              <div className="flex items-center">
                <User size={14} className="mr-1.5" />
                {device.ownerName || 'Unassigned'}
              </div>
              <div className="flex items-center">
                <Clock size={14} className="mr-1.5" />
                Last Sync: {device.lastSync}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onViewTelemetry && (
              <button
                onClick={() => onViewTelemetry(device.id)}
                className="px-5 py-2.5 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer"
              >
                View Live Telemetry
              </button>
            )}
            <button
              onClick={() => onManageCommands(device.id)}
              className="px-5 py-2.5 bg-[#1B7A6E] hover:bg-[#145F56] text-white rounded-sm text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer shadow-sm"
            >
              Command Center
            </button>
          </div>
        </div>
      </div>

      {/* Detail Content Area (Device Analysis Section) */}
      <DeviceAnalysisSection device={device} />
    </div>
  );
}
