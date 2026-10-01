import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Server, Activity, AlertTriangle, Terminal, Wifi, WifiOff, Map, Clock,
  ChevronRight, Zap, DownloadCloud, Search, ShieldCheck,
  TrendingUp, TrendingDown, Minus, Shield, Cpu, Radio, HardDrive,
  Layers, ArrowUpRight, CheckCircle2, Sliders, ExternalLink, Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- TYPES ---
export interface DeviceFleetDashboardProps {
  userName?: string;
  userRole?: string;
  metricsData?: any;
  availableDevices?: any[];
  alarms?: any[];
  sparklines?: Record<string, number[]>;
  isLoading?: boolean;
  onMetricClick?: (metricType: string) => void;
  onViewAlarm?: (alarmId: string) => void;
  onViewCommand?: (deviceId: string) => void;
  onViewDevice?: (deviceId: string) => void;
  onNavigateToDevices?: () => void;
  onNavigateToAlarms?: () => void;
  onNavigateToCommandCenter?: (deviceId: string) => void;
  onSearchDevice?: (deviceId: string) => void;
  onNavigateToFleetMap?: () => void;
  onNavigateToTelemetry?: (deviceId?: string) => void;
}

// --- MINI SPARKLINE ---
function Sparkline({ data, color = '#1B7A6E', height = 24 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 72; const h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const trend = data[data.length - 1] - data[0];
  return (
    <div className="flex items-center gap-1.5">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.85"
        />
        <circle
          cx={w}
          cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
          r="2.5"
          fill={color}
        />
      </svg>
      <span className="text-[9px] font-mono font-bold" style={{ color }}>
        {trend > 0 ? '+' : ''}{trend}
      </span>
    </div>
  );
}

// --- FLEET HEALTH SCORE GAUGE ---
function FleetHealthScore({ devices, alarms }: { devices: any[]; alarms: any[] }) {
  const score = useMemo(() => {
    if (devices.length === 0) return 0;
    const pctOnline = devices.filter(d => d.connectivityStatus === 'Online').length / devices.length;
    const pctNoCritical = 1 - (alarms.filter(a => (a.severity === 'Critical' || a.severity === 'critical') && (a.status === 'Active' || a.status === 'unacknowledged')).length / Math.max(devices.length, 1));
    return Math.round((pctOnline * 0.5 + Math.min(pctNoCritical, 1) * 0.5) * 100);
  }, [devices, alarms]);

  const color = score >= 80 ? '#1B7A6E' : score >= 60 ? '#D99B3F' : '#C4453D';
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Degraded' : 'Attention';
  const TrendIcon = score >= 80 ? TrendingUp : score >= 60 ? Minus : TrendingDown;

  const r = 44; const cx = 56; const cy = 56;
  const pct = Math.max(0, Math.min(score / 100, 1));
  const theta = pct * Math.PI;
  const x = cx - r * Math.cos(theta);
  const y = cy - r * Math.sin(theta);

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Shield size={12} className="text-[#1B7A6E]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Fleet Health</span>
      </div>
      <div className="relative">
        <svg width={112} height={64} viewBox="0 0 112 64">
          <path d={`M 12 56 A ${r} ${r} 0 0 1 100 56`} fill="none" stroke="#262626" strokeWidth="7" strokeLinecap="round" opacity="0.4" />
          <path d={`M 12 56 A ${r} ${r} 0 0 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
          <text x={cx} y={50} textAnchor="middle" fill={color} fontSize="22" fontWeight="bold" fontFamily="monospace">{score}</text>
          <text x={cx} y={62} textAnchor="middle" fill="#9A9A9A" fontSize="8" fontFamily="sans-serif">/ 100</text>
        </svg>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-bold mt-0.5" style={{ color }}>
        <TrendIcon size={12} />
        <span>{label}</span>
      </div>
    </div>
  );
}

// --- HARDWARE SUBSYSTEM SPEC DATA WITH MOUSE HOVER ZONES ---
interface HardwareSubsystem {
  id: string;
  name: string;
  category: string;
  tag: string;
  icon: any;
  summary: string;
  details: string[];
  zone: { xMin: number; xMax: number; yMin: number; yMax: number };
}

const HARDWARE_SUBSYSTEMS: HardwareSubsystem[] = [
  {
    id: 'mcu',
    name: 'STM32 Ultra-Low-Power MCU',
    category: 'Core Processing',
    tag: 'ARM Cortex Core',
    icon: Cpu,
    summary: 'Central edge processor running high-precision analog sampling, decimation DSP routines, and power management.',
    details: [
      'Executes synchronized ADC acquisition for continuous dual-channel ECG',
      'Samples 3-axis motion accelerometry via SPI/I2C at 50Hz',
      'Manages sleep & active states for extended ambulatory battery runtime',
      'Packages deterministic 10s binary telemetry payloads'
    ],
    zone: { xMin: 36.5, xMax: 44.5, yMin: 61, yMax: 69.5 }
  },
  {
    id: 'modem',
    name: 'SIMCom A7670 LTE Cat-1 Modem',
    category: 'Cellular Engine',
    tag: '4G LTE Cat-1 · CE Certified',
    icon: Radio,
    summary: 'High-efficiency cellular engine with micro-coax RF feeder to flexible patch antenna for real-time cloud data upload.',
    details: [
      'Direct HTTP/TCP telemetry streaming to central cloud ingestion pipeline',
      'Cell tower triangulation headers (MCC: 636, MNC: 01 Ethio Telecom / 02 Safaricom, TAC, Cell ID)',
      'Sub-second packet handoff with low power standby current',
      'Nano-SIM socket with hardware ESD suppression'
    ],
    zone: { xMin: 45.5, xMax: 60.5, yMin: 64.5, yMax: 79 }
  },
  {
    id: 'ecg',
    name: 'Differential ECG Analog Front-End',
    category: 'Biopotential',
    tag: 'Differential LA/RA Leads',
    icon: Activity,
    summary: 'Clinical-grade biopotential analog input stage designed for low-noise cardiac signal acquisition with baseline wander rejection.',
    details: [
      'Differential input terminals with dedicated Right Arm (RA) and Left Arm (LA) leads',
      'Onboard passive & active filtering to reject 50Hz/60Hz mains interference',
      '500 Samples/sec sampling rate capturing crisp P-wave, QRS complex, and T-wave features',
      'Hardware ESD diode array protecting patient and IC against electrostatic discharge'
    ],
    zone: { xMin: 23, xMax: 34, yMin: 53.5, yMax: 71 }
  },
  {
    id: 'imu',
    name: '6-Axis Inertial Motion Unit (IMU)',
    category: 'Kinematics',
    tag: 'Accelerometer & Posture',
    icon: Sliders,
    summary: 'Synchronous motion sensor capturing 3D acceleration to correlate cardiac rate changes with patient physical movement.',
    details: [
      'Synchronous 3-axis acceleration tracking in milligravity (mg)',
      'Distinguishes physiological sinus tachycardia (exercise) from pathological arrhythmias',
      'Enables ML posture classification (Supine, Upright Stationary, Walking)',
      'Automated motion-artifact detection for ECG signal quality scoring'
    ],
    zone: { xMin: 35, xMax: 43, yMin: 51.5, yMax: 60 }
  },
  {
    id: 'storage',
    name: 'SanDisk Ultra MicroSD Failsafe Storage',
    category: 'Local Storage',
    tag: '128 GB Local Ring-Buffer',
    icon: HardDrive,
    summary: 'High-capacity onboard MicroSD logging providing zero-data-loss insurance during cellular dead zones or transit.',
    details: [
      'Continuous local FAT32 binary stream recording concurrent with cellular streaming',
      'Ensures 100% data retention even in deep rural or shielded clinical environments',
      'Automatic resume & sync mechanism when cellular connectivity is re-established',
      'High-speed SPI interface with hardware power-cut corruption guards'
    ],
    zone: { xMin: 43.5, xMax: 54, yMin: 51, yMax: 59 }
  },
  {
    id: 'power',
    name: 'Power & Battery Charging Subsystem',
    category: 'Power Management',
    tag: 'USB-C · BUCK_3V3 · LiPo Circuit',
    icon: Zap,
    summary: 'High-efficiency step-down buck regulators and LiPo battery charging interface with onboard diagnostic status LEDs.',
    details: [
      'High-efficiency synchronous BUCK_3V3 regulator for clean analog/digital rails',
      'USB-C connector for rapid battery charging and direct UART debug telemetry',
      'Dedicated diagnostic LEDs: NETLIGHT (cellular link), STDBY, and CHRG',
      'Ultra-low quiescent current standby architecture'
    ],
    zone: { xMin: 55, xMax: 72, yMin: 50.5, yMax: 74 }
  }
];

// --- MAIN LANDING / HOME PAGE ---
export default function DeviceFleetDashboard({
  userName = 'Admin User',
  userRole = 'Administrator',
  metricsData,
  availableDevices = [],
  alarms = [],
  sparklines,
  isLoading = false,
  onMetricClick = () => {},
  onViewAlarm = () => {},
  onViewCommand = () => {},
  onViewDevice = () => {},
  onNavigateToDevices = () => {},
  onNavigateToAlarms = () => {},
  onNavigateToCommandCenter = () => {},
  onSearchDevice = () => {},
  onNavigateToFleetMap = () => {},
  onNavigateToTelemetry = () => {}
}: DeviceFleetDashboardProps) {

  const [activeSubsystemIndex, setActiveSubsystemIndex] = useState<number>(0);

  const activeSubsystem = useMemo(() => {
    return HARDWARE_SUBSYSTEMS[activeSubsystemIndex] || HARDWARE_SUBSYSTEMS[0];
  }, [activeSubsystemIndex]);

  // iPhone-style automated slideshow: seamlessly cycles through each subsystem
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSubsystemIndex(prev => (prev + 1) % HARDWARE_SUBSYSTEMS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const computedMetrics = metricsData || {
    totalDevices: availableDevices.length,
    online: availableDevices.filter((d: any) => d.connectivityStatus === 'Online').length,
    offline: availableDevices.filter((d: any) => d.connectivityStatus !== 'Online').length,
    activeAlarms: alarms.filter((a: any) => a.status === 'Active' || a.status === 'unacknowledged').length,
    commandsToday: 6,
    firmwareUpdatesPending: availableDevices.filter((d: any) => d.firmwareUpdateAvailable).length
  };

  const sparks = sparklines || {
    totalDevices: [],
    online: [],
    offline: [],
    activeAlarms: [],
    commandsToday: [],
    firmwarePending: [],
  };

  const METRIC_CARDS = [
    {
      id: 'total-devices', label: 'Registered Devices', Icon: Server,
      value: computedMetrics.totalDevices,
      color: '#9A9A9A', sparkKey: 'totalDevices',
    },
    {
      id: 'online', label: 'Online Telemetry', Icon: Wifi,
      value: computedMetrics.online,
      color: '#1B7A6E', sparkKey: 'online',
    },
    {
      id: 'offline', label: 'Disconnected', Icon: WifiOff,
      value: computedMetrics.offline,
      color: '#C4453D', sparkKey: 'offline',
    },
    {
      id: 'active-alarms', label: 'Active Alarms', Icon: AlertTriangle,
      value: computedMetrics.activeAlarms,
      color: computedMetrics.activeAlarms > 0 ? '#C4453D' : '#9A9A9A', sparkKey: 'activeAlarms',
    },
    {
      id: 'commands-today', label: 'Commands Dispatched', Icon: Terminal,
      value: computedMetrics.commandsToday,
      color: '#1B7A6E', sparkKey: 'commandsToday',
    },
    {
      id: 'firmware-pending', label: 'Updates Pending', Icon: DownloadCloud,
      value: computedMetrics.firmwareUpdatesPending,
      color: '#D99B3F', sparkKey: 'firmwarePending',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 h-full bg-light-bg dark:bg-[#000000]">
        <div className="w-8 h-8 border-2 border-[#1B7A6E]/30 border-t-[#1B7A6E] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-light-bg dark:bg-[#050505] text-light-text dark:text-dark-text overflow-y-auto relative scroll-smooth">

      {/* Background Animated Gradient / Glass Glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-[#1B7A6E]/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[400px] right-1/4 w-[500px] h-[350px] bg-[#D99B3F]/5 rounded-full blur-[160px] pointer-events-none" />

      <div className="px-6 md:px-12 py-10 max-w-[1300px] mx-auto w-full flex flex-col gap-12 relative z-10">

        {/* ── 1. HERO SECTION WITH SLIDING GLASS FEELING ─────────────────── */}
        <section className="relative overflow-hidden rounded-2xl p-8 md:p-12 border border-black/5 dark:border-white/10 bg-white/70 dark:bg-[#0c0c0c]/70 backdrop-blur-xl shadow-2xl">
          
          {/* Subtle ECG Line Background SVG */}
          <div className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-15 overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 1200 240" preserveAspectRatio="none">
              <path
                d="M0,120 L300,120 L320,80 L330,160 L345,30 L360,190 L375,120 L420,120 L440,105 L460,120 L750,120 L770,80 L780,160 L795,30 L810,190 L825,120 L870,120 L890,105 L910,120 L1200,120"
                fill="none"
                stroke="#1B7A6E"
                strokeWidth="2.5"
              />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-4xl mx-auto space-y-5">
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-slate-900 dark:text-white">
              TIRTATRACE
              <span className="block text-lg sm:text-xl md:text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#1B7A6E] via-[#3ADB8F] to-[#D99B3F] mt-2">
                Continuous Ambulatory Telemetry & Edge Intelligence
              </span>
            </h1>

            {/* Project Overview Narrative */}
            <p className="text-sm md:text-base text-slate-700 dark:text-[#A0A0A0] leading-relaxed max-w-3xl mx-auto">
              An end-to-end clinical monitoring ecosystem designed for uninterrupted cardiac patient telemetry. 
              Combines high-fidelity dual-lead ECG recording, synchronous 6-axis kinematic accelerometry, fail-safe 
              local MicroSD backup logging, and automated cellular cloud upload with machine-learning rhythm classification.
            </p>

            {/* Quick Action Portals (Sliding Glass Buttons) */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <button
                onClick={onNavigateToDevices}
                className="px-6 py-2.5 bg-[#1B7A6E] hover:bg-[#145F56] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg hover:shadow-[#1B7A6E]/25 hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer"
              >
                <Server size={14} />
                <span>Explore Device Fleet</span>
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">{computedMetrics.totalDevices}</span>
              </button>

              <button
                onClick={onNavigateToFleetMap}
                className="px-6 py-2.5 bg-white/70 dark:bg-white/5 hover:bg-white/95 dark:hover:bg-white/10 text-slate-900 dark:text-[#F2F2F2] border border-slate-300 dark:border-white/15 rounded-xl text-xs font-bold uppercase tracking-wider transition-all backdrop-blur-md hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Map size={14} className="text-[#D99B3F]" />
                <span>Cell Tower Map</span>
              </button>
            </div>

          </div>
        </section>


        {/* ── 2. HARDWARE PRODUCT SHOWCASE — Side-by-Side Image & Glazed Note Slideshow ── */}
        <section className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#0c0c0c]/90 backdrop-blur-xl p-6 sm:p-8 lg:p-10 shadow-sm transition-colors">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

            {/* ── LEFT COLUMN: TRANSPARENT HARDWARE DEVICE WITH ACCURATE TARGET HIGHLIGHT ── */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center">
              <div className="relative w-full max-w-[500px] aspect-square mx-auto rounded-3xl bg-gradient-to-b from-slate-100/90 to-slate-200/50 dark:from-white/[0.04] dark:to-white/[0.01] border border-slate-200/80 dark:border-white/10 p-3 sm:p-5 flex items-center justify-center overflow-hidden shadow-xl">
                {/* Ambient glow in dark mode */}
                <div className="absolute inset-0 bg-radial from-[#1B7A6E]/10 dark:from-[#3ADB8F]/15 to-transparent pointer-events-none rounded-3xl" />

                {/* 1:1 image positioning canvas */}
                <div className="relative w-full h-full">
                  <img
                    src="/ecg_device_transparent.png"
                    alt="TIRTATRACE REV 1.0 Custom Hardware"
                    className="w-full h-full object-contain pointer-events-none select-none drop-shadow-2xl"
                  />

                  {/* Dynamic Precision Green Target Box showing the specific component on the board */}
                  <AnimatePresence mode="wait">
                    {activeSubsystem && (
                      <motion.div
                        key={activeSubsystem.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                        style={{
                          left: `${activeSubsystem.zone.xMin}%`,
                          top: `${activeSubsystem.zone.yMin}%`,
                          width: `${activeSubsystem.zone.xMax - activeSubsystem.zone.xMin}%`,
                          height: `${activeSubsystem.zone.yMax - activeSubsystem.zone.yMin}%`,
                        }}
                        className="absolute z-10 pointer-events-none"
                      >
                        {/* Glowing neon green bounding box */}
                        <div className="w-full h-full border-2 border-[#10B981] dark:border-[#3ADB8F] rounded-lg bg-[#10B981]/15 dark:bg-[#3ADB8F]/25 shadow-[0_0_20px_rgba(16,185,129,0.55)] dark:shadow-[0_0_25px_rgba(58,219,143,0.7)] relative">
                          
                          {/* Corner alignment crosshairs */}
                          <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#10B981] dark:border-[#3ADB8F]" />
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#10B981] dark:border-[#3ADB8F]" />
                          <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#10B981] dark:border-[#3ADB8F]" />
                          <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#10B981] dark:border-[#3ADB8F]" />

                          {/* Floating active component tag */}
                          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-950/95 text-white dark:text-[#3ADB8F] text-[9px] font-mono font-bold tracking-tight whitespace-nowrap shadow-lg border border-[#10B981]/50 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] dark:bg-[#3ADB8F] animate-ping" />
                            <span>{activeSubsystem.tag}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>

              {/* Sub-label under the image */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#1B7A6E] dark:bg-[#3ADB8F]" />
                  Differential Biopotential
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Cellular Cat-1 IoT
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  6-Axis IMU
                </span>
              </div>
            </div>

            {/* ── RIGHT COLUMN: ULTRA-GLAZED FROSTED LIQUID-GLASS SLIDESHOW CARD ── */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              {/* Authentic visionOS / iPhone Layered Frosted Glass Frame */}
              <div className="relative rounded-3xl p-6 sm:p-8 lg:p-9 min-h-[500px] flex flex-col justify-between overflow-hidden
                bg-gradient-to-br from-white/80 via-white/45 to-white/70 dark:from-white/[0.08] dark:via-black/35 dark:to-white/[0.02]
                backdrop-blur-3xl
                border border-white/80 dark:border-white/15
                shadow-[0_20px_50px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(0,0,0,0.05)]
                dark:shadow-[0_25px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.25)]
              ">

                {/* Shimmering Ambient Light Refraction Orbs behind frosted glass */}
                <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-br from-[#1B7A6E]/20 via-teal-400/20 to-transparent dark:from-[#3ADB8F]/25 dark:via-emerald-500/15 to-transparent blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-gradient-to-tr from-cyan-400/15 via-blue-500/10 to-transparent dark:from-cyan-500/15 dark:via-blue-600/10 to-transparent blur-3xl pointer-events-none" />

                {/* Curved Specular Reflection Layer */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/5 to-transparent dark:from-white/10 dark:via-transparent pointer-events-none rounded-3xl" />

                {/* Header inside glass frame */}
                <div className="relative z-1">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/80 dark:border-white/15 shadow-sm text-xs font-bold uppercase tracking-wider text-[#1B7A6E] dark:text-[#3ADB8F]">
                      <Cpu size={14} />
                      <span>Custom Medical IoT Hardware</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-300 px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
                      REV 1.0 · 2026
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                    Custom Telemetry Hardware Device
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-2 leading-relaxed font-medium">
                    Continuous 24/7 cardiac monitoring, motion kinematics correlation, and failsafe cloud ingestion.
                  </p>
                </div>

                {/* Dynamic 3D-Depth Slide Presentation (Creative Apple-style Reveal) */}
                <div className="relative z-1 my-5 overflow-hidden" style={{ perspective: 1000 }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSubsystem.id}
                      initial={{ opacity: 0, y: 32, scale: 0.94, filter: 'blur(8px)' }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -24, scale: 1.03, filter: 'blur(6px)' }}
                      transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-4"
                    >
                      {/* Active Subsystem Header Bar */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <motion.div
                            initial={{ scale: 0.6, rotate: -15 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 450, damping: 20 }}
                            className="w-11 h-11 rounded-2xl bg-gradient-to-br from-white/90 to-white/60 dark:from-white/15 dark:to-white/5 backdrop-blur-xl text-[#1B7A6E] dark:text-[#3ADB8F] flex items-center justify-center shrink-0 shadow-md border border-white/80 dark:border-white/20"
                          >
                            <activeSubsystem.icon size={22} />
                          </motion.div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#1B7A6E] dark:text-[#3ADB8F] font-mono block">
                              {activeSubsystem.category}
                            </span>
                            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
                              {activeSubsystem.name}
                            </h3>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-white/70 dark:bg-white/10 text-slate-900 dark:text-slate-200 border border-white/80 dark:border-white/15 shadow-sm shrink-0">
                          {activeSubsystem.tag}
                        </span>
                      </div>

                      {/* Subsystem Summary Note */}
                      <p className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed font-semibold">
                        {activeSubsystem.summary}
                      </p>

                      {/* Engineering Notes presented as Frosted Glass Tile Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {activeSubsystem.details.map((detail, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 + idx * 0.07, duration: 0.35, ease: 'easeOut' }}
                            className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/65 dark:bg-white/[0.04] backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
                          >
                            <div className="w-5 h-5 rounded-lg bg-[#1B7A6E]/15 dark:bg-[#3ADB8F]/20 text-[#1B7A6E] dark:text-[#3ADB8F] flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle2 size={12} className="stroke-[2.5]" />
                            </div>
                            <span className="text-xs text-slate-900 dark:text-slate-100 font-semibold leading-snug">
                              {detail}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

              </div>
            </div>

          </div>
        </section>


        {/* ── 3. "AT A GLANCE" SYSTEM STATUS (BELOW HARDWARE SHOWCASE) ───── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-[#9A9A9A] flex items-center gap-2">
              <Sparkles size={13} className="text-[#1B7A6E]" />
              <span>At a Glance · Operational Fleet Summary</span>
            </h2>
            <button
              onClick={onNavigateToDevices}
              className="text-[11px] font-bold uppercase tracking-wider text-[#1B7A6E] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Fleet</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            
            {/* Fleet Health Score Gauge (Frosted Glass Card) */}
            <div className="md:col-span-3 rounded-xl p-5 border border-black/5 dark:border-white/10 bg-white/70 dark:bg-[#0c0c0c]/70 backdrop-blur-xl flex items-center justify-center shadow-lg">
              <FleetHealthScore devices={availableDevices} alarms={alarms} />
            </div>

            {/* Metric Cards (Frosted Glass Grid) */}
            <div className="md:col-span-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {METRIC_CARDS.slice(0, 5).map(card => (
                <button
                  key={card.id}
                  onClick={() => onMetricClick(card.id)}
                  className="rounded-xl p-4 border border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#0c0c0c]/60 backdrop-blur-md text-left transition-all hover:scale-[1.02] hover:border-[#1B7A6E]/40 hover:shadow-lg cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center mb-1.5" style={{ color: card.color }}>
                      <card.Icon size={14} className="mr-1.5 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider leading-tight line-clamp-1">{card.label}</span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-slate-900 dark:text-[#F2F2F2] mb-1">
                      {card.value}
                    </div>
                  </div>
                  {sparks[card.sparkKey] && sparks[card.sparkKey].length > 0 && (
                    <div className="mt-2 pt-1 border-t border-gray-100 dark:border-white/5">
                      <Sparkline data={sparks[card.sparkKey]} color={card.color} height={20} />
                    </div>
                  )}
                </button>
              ))}
            </div>

          </div>
        </section>


        {/* ── 4. END-TO-END TELEMETRY PIPELINE (SLIDING CARDS) ────────────── */}
        <section className="space-y-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#1B7A6E] uppercase tracking-widest mb-1">
              <Layers size={13} />
              <span>Full-Stack Architecture</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-light-text dark:text-[#F2F2F2]">
              End-to-End Cardiac Telemetry Pipeline
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Step 1 */}
            <div className="rounded-xl p-5 border border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#0c0c0c]/60 backdrop-blur-md space-y-3 relative group hover:border-[#1B7A6E]/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#1B7A6E] px-2 py-0.5 rounded bg-[#1B7A6E]/10">01 · Edge</span>
                <Activity size={16} className="text-[#1B7A6E]" />
              </div>
              <h4 className="text-sm font-bold text-light-text dark:text-[#F2F2F2]">Synchronous Edge Sampling</h4>
              <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] leading-relaxed">
                Dual-channel differential ECG sampled at 500 S/s alongside 3-axis IMU acceleration at 50 Hz.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl p-5 border border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#0c0c0c]/60 backdrop-blur-md space-y-3 relative group hover:border-[#1B7A6E]/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#D99B3F] px-2 py-0.5 rounded bg-[#D99B3F]/10">02 · Ingest</span>
                <Radio size={16} className="text-[#D99B3F]" />
              </div>
              <h4 className="text-sm font-bold text-light-text dark:text-[#F2F2F2]">Cellular Cloud Transmission</h4>
              <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] leading-relaxed">
                SIMCom A7670 LTE streams 10-second compressed packets with cell tower triangulation headers.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl p-5 border border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#0c0c0c]/60 backdrop-blur-md space-y-3 relative group hover:border-[#1B7A6E]/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#1B7A6E] px-2 py-0.5 rounded bg-[#1B7A6E]/10">03 · Cloud</span>
                <Server size={16} className="text-[#1B7A6E]" />
              </div>
              <h4 className="text-sm font-bold text-light-text dark:text-[#F2F2F2]">Decimation & Ingestion</h4>
              <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] leading-relaxed">
                Timescale/PostgreSQL stores telemetry sessions, raw leads, and cell tower geolocation tables.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-xl p-5 border border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#0c0c0c]/60 backdrop-blur-md space-y-3 relative group hover:border-[#1B7A6E]/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#3ADB8F] px-2 py-0.5 rounded bg-[#3ADB8F]/10">04 · ML AI</span>
                <Zap size={16} className="text-[#3ADB8F]" />
              </div>
              <h4 className="text-sm font-bold text-light-text dark:text-[#F2F2F2]">Automated ML Inference</h4>
              <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] leading-relaxed">
                10s packet motion classification (Supine/Walking) + 30s continuous rhythm analysis (Sinus/AF).
              </p>
            </div>

          </div>
        </section>


        {/* ── 5. CORE CAPABILITIES (FROSTED GLASS GRID) ──────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-8">
          
          <div className="rounded-xl p-6 border border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#0c0c0c]/60 backdrop-blur-md space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1B7A6E]/10 border border-[#1B7A6E]/30 flex items-center justify-center text-[#1B7A6E]">
              <Map size={16} />
            </div>
            <h3 className="text-sm font-bold text-light-text dark:text-[#F2F2F2]">Cell Tower Triangulation</h3>
            <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] leading-relaxed">
              Geolocates ambulatory devices natively using LTE cellular tower metadata (MCC 636 Ethio Telecom & Safaricom) without battery-draining GPS engines.
            </p>
          </div>

          <div className="rounded-xl p-6 border border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#0c0c0c]/60 backdrop-blur-md space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D99B3F]/10 border border-[#D99B3F]/30 flex items-center justify-center text-[#D99B3F]">
              <HardDrive size={16} />
            </div>
            <h3 className="text-sm font-bold text-light-text dark:text-[#F2F2F2]">Disconnect-Resilient Storage</h3>
            <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] leading-relaxed">
              When entering shielded buildings or low-coverage transit zones, the SanDisk Ultra 128GB logger records seamlessly and uploads catch-up batches upon reconnect.
            </p>
          </div>

          <div className="rounded-xl p-6 border border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#0c0c0c]/60 backdrop-blur-md space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C4453D]/10 border border-[#C4453D]/30 flex items-center justify-center text-[#C4453D]">
              <AlertTriangle size={16} />
            </div>
            <h3 className="text-sm font-bold text-light-text dark:text-[#F2F2F2]">Automated Clinical Alarms</h3>
            <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] leading-relaxed">
              Immediate event triggers for suspected arrhythmias, sudden motion spikes, disconnects, and low battery thresholds dispatched directly to care teams.
            </p>
          </div>

        </section>

      </div>
    </div>
  );
}
