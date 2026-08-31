import React, { useState, useMemo } from 'react';
import { 
  Server, Activity, AlertTriangle, Terminal, Wifi, WifiOff, Map, Clock, 
  ChevronRight, Battery, Zap, DownloadCloud, Search, ShieldCheck,
  TrendingUp, TrendingDown, Minus, Shield
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const FIRMWARE_COLORS = ['#1B7A6E', '#3ADB8F', '#7C8A94'];

// --- TYPES ---
export interface DeviceFleetDashboardProps {
  userName?: string;
  userRole?: string;
  metricsData?: any;
  connectivityTrendData?: any[];
  alarmTrendData?: any[];
  firmwareBreakdown?: any[];
  recentActivity?: any[];
  recentlyManagedDevice?: any | null;
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
}

// --- MINI SPARKLINE ──────────────────────────────────────────────────────────
function Sparkline({ data, color = '#1B7A6E', height = 36 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80; const h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const trend = data[data.length - 1] - data[0];
  return (
    <div className="flex items-end gap-1.5">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Last point dot */}
        <circle
          cx={w}
          cy={h - ((data[data.length - 1] - min) / range) * h}
          r="2.5"
          fill={color}
        />
      </svg>
      <span className="text-[9px] font-bold" style={{ color }}>
        {trend > 0 ? '+' : ''}{trend}
      </span>
    </div>
  );
}

// --- FLEET HEALTH SCORE ──────────────────────────────────────────────────────
function FleetHealthScore({ devices, alarms }: { devices: any[]; alarms: any[] }) {
  const score = useMemo(() => {
    if (devices.length === 0) return 0;
    const pctOnline = devices.filter(d => d.connectivityStatus === 'Online').length / devices.length;
    const pctNoCritical = 1 - (alarms.filter(a => (a.severity === 'Critical' || a.severity === 'critical') && (a.status === 'Active' || a.status === 'unacknowledged')).length / Math.max(devices.length, 1));
    const pctBattery = devices.filter(d => d.batteryLevel > 20).length / devices.length;
    return Math.round((pctOnline * 0.4 + Math.min(pctNoCritical, 1) * 0.4 + pctBattery * 0.2) * 100);
  }, [devices, alarms]);

  const color = score >= 80 ? '#1B7A6E' : score >= 60 ? '#D99B3F' : '#C4453D';
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Degraded' : 'Critical';
  const TrendIcon = score >= 80 ? TrendingUp : score >= 60 ? Minus : TrendingDown;

  // SVG arc for the gauge
  const r = 44; const cx = 56; const cy = 56;
  const pct = score / 100;
  const theta = pct * Math.PI;
  const x = cx - r * Math.cos(theta);
  const y = cy - r * Math.sin(theta);

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-2">
      <div className="flex items-center gap-2 mb-1">
        <Shield size={13} className="text-[#9A9A9A]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Fleet Health</span>
      </div>
      <div className="relative">
        <svg width={112} height={64} viewBox="0 0 112 64">
          {/* Track */}
          <path d={`M 12 56 A ${r} ${r} 0 0 1 100 56`} fill="none" stroke="#262626" strokeWidth="8" strokeLinecap="round" />
          {/* Fill */}
          <path d={`M 12 56 A ${r} ${r} 0 0 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
          {/* Text */}
          <text x={cx} y={52} textAnchor="middle" fill={color} fontSize="22" fontWeight="bold" fontFamily="Inter, sans-serif">{score}</text>
          <text x={cx} y={63} textAnchor="middle" fill="#9A9A9A" fontSize="8" fontFamily="Inter, sans-serif">/ 100</text>
        </svg>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color }}>
        <TrendIcon size={12} />
        {label}
      </div>
    </div>
  );
}

// --- DEVICE DOT GRID ─────────────────────────────────────────────────────────
function DeviceDotGrid({ devices, onNavigateToDevices }: { devices: any[]; onNavigateToDevices: () => void }) {
  return (
    <div className="flex flex-wrap gap-2 p-2">
      {devices.map(d => {
        const isOnline = d.connectivityStatus === 'Online';
        const lowBatt = d.batteryLevel <= 20;
        const color = !isOnline ? '#C4453D' : lowBatt ? '#D99B3F' : '#1B7A6E';
        return (
          <div
            key={d.id}
            title={`${d.id} — ${d.connectivityStatus}${lowBatt ? ' · Low Battery' : ''}`}
            className="w-3 h-3 rounded-full cursor-pointer transition-transform hover:scale-150"
            style={{ backgroundColor: color, opacity: isOnline ? 1 : 0.5 }}
          />
        );
      })}
    </div>
  );
}

// --- MAIN PAGE ---
export default function DeviceFleetDashboard({
  userName = 'Admin User',
  userRole = 'Administrator',
  metricsData,
  connectivityTrendData = [],
  alarmTrendData = [],
  firmwareBreakdown = [],
  recentActivity = [],
  recentlyManagedDevice = null,
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
  onSearchDevice = () => {}
}: DeviceFleetDashboardProps) {
  
  const [connTimeRange, setConnTimeRange] = useState('7D');
  const [alarmTimeRange, setAlarmTimeRange] = useState('7D');
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceView, setDeviceView] = useState<'list' | 'grid'>('list');

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
      id: 'total-devices', label: 'Total Devices', Icon: Server,
      value: computedMetrics.totalDevices,
      color: '#9A9A9A', sparkKey: 'totalDevices',
    },
    {
      id: 'online', label: 'Online', Icon: Wifi,
      value: computedMetrics.online,
      color: '#1B7A6E', sparkKey: 'online',
    },
    {
      id: 'offline', label: 'Offline', Icon: WifiOff,
      value: computedMetrics.offline,
      color: '#C4453D', sparkKey: 'offline',
    },
    {
      id: 'active-alarms', label: 'Active Alarms', Icon: AlertTriangle,
      value: computedMetrics.activeAlarms,
      color: computedMetrics.activeAlarms > 0 ? '#C4453D' : '#9A9A9A', sparkKey: 'activeAlarms',
    },
    {
      id: 'commands-today', label: 'Commands Today', Icon: Terminal,
      value: computedMetrics.commandsToday,
      color: '#7C8A94', sparkKey: 'commandsToday',
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
        <div className="w-8 h-8 border-2 border-[#1B7A6E]/30 border-t-[#1B7A6E] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-light-bg dark:bg-[#000000] text-light-text dark:text-dark-text overflow-auto">
      <div className="px-8 md:px-12 py-10 max-w-[1200px] mx-auto w-full flex flex-col gap-16">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-200 dark:border-[#262626] pb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">System Overview</h1>
            <p className="text-sm text-light-text-secondary dark:text-[#9A9A9A]">
              Welcome back, <span className="font-bold text-light-text dark:text-[#F2F2F2]">{userName}</span>. Here is the current status of your device fleet.
            </p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-[#9A9A9A] pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search devices..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 pl-9 pr-4 py-2 bg-transparent border border-gray-300 dark:border-[#333] rounded-sm text-sm outline-none focus:ring-1 focus:ring-[#1B7A6E]"
            />
            {searchQuery && (
              <div className="absolute top-full right-0 mt-1 w-full bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm shadow-xl z-50 max-h-60 overflow-y-auto py-1">
                {availableDevices.filter(d => d.id.toLowerCase().includes(searchQuery.toLowerCase())).map(d => (
                  <button
                    key={d.id}
                    onClick={() => { onSearchDevice(d.id); setSearchQuery(''); }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-light-text dark:text-[#F2F2F2]"
                  >
                    <span className="font-mono">{d.id}</span>
                    {d.ownerName && <span className="ml-2 text-[#9A9A9A] text-xs">· {d.ownerName}</span>}
                  </button>
                ))}
                {availableDevices.filter(d => d.id.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-sm text-light-text-secondary dark:text-[#9A9A9A]">No devices found.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics + Fleet Health - Unboxed */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-6">At a Glance</h2>
          <div className="flex flex-wrap gap-8 items-center justify-between">
            {/* Fleet Health Score */}
            <div className="pr-8 md:border-r border-gray-200 dark:border-[#262626]">
              <FleetHealthScore devices={availableDevices} alarms={alarms} />
            </div>

            {/* Metric Cards */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {METRIC_CARDS.map(card => (
                <button
                  key={card.id}
                  onClick={() => onMetricClick(card.id)}
                  className="card-3d p-4 flex flex-col text-left group hover:scale-[1.02] transition-transform outline-none cursor-pointer"
                >
                  <div className="flex items-center mb-1" style={{ color: card.color }}>
                    <card.Icon size={14} className="mr-1.5 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider leading-tight">{card.label}</span>
                  </div>
                  <div className="text-2xl font-bold mb-1" style={{ color: card.color === '#9A9A9A' ? undefined : card.color }}>
                    {card.value}
                  </div>
                  {sparks[card.sparkKey] && sparks[card.sparkKey].length > 0 && (
                    <Sparkline data={sparks[card.sparkKey]} color={card.color} height={20} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>


        {/* Main Charts & Activity Flow */}
        <div className="flex flex-col xl:flex-row gap-12 mt-8">
          
          {/* Connectivity Trend — Single Column Unboxed */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Device Connectivity Trend</h2>
              <div className="flex gap-4">
                {['24H', '7D', '30D'].map(range => (
                  <button 
                    key={range}
                    onClick={() => setConnTimeRange(range)}
                    className={`text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 outline-none transition-colors ${connTimeRange === range ? 'border-[#1B7A6E] text-[#1B7A6E]' : 'border-transparent text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={connectivityTrendData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B7A6E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1B7A6E" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOffline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C4453D" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#C4453D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="time" stroke="#444" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#444" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '4px', fontSize: '12px' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="circle" />
                  <Area name="Online" type="monotone" dataKey="online" stroke="#1B7A6E" strokeWidth={2} fill="url(#colorOnline)" dot={false} activeDot={{ r: 4 }} />
                  <Area name="Offline" type="monotone" dataKey="offline" stroke="#C4453D" strokeWidth={2} fill="url(#colorOffline)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alarm Trend — Single Column Unboxed */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Alarm Activity</h2>
              <div className="flex gap-4">
                {['24H', '7D', '30D'].map(range => (
                  <button 
                    key={range}
                    onClick={() => setAlarmTimeRange(range)}
                    className={`text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 outline-none transition-colors ${alarmTimeRange === range ? 'border-[#1B7A6E] text-[#1B7A6E]' : 'border-transparent text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={alarmTrendData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="time" stroke="#444" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#444" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '4px', fontSize: '12px', color: '#F2F2F2' }}
                    itemStyle={{ fontWeight: 'bold' }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="circle" />
                  <Bar name="Critical" dataKey="critical" stackId="a" fill="#C4453D" radius={[0,0,0,0]} />
                  <Bar name="Warning" dataKey="warning" stackId="a" fill="#D99B3F" />
                  <Bar name="Info" dataKey="info" stackId="a" fill="#7C8A94" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Lower Section Stacked (Firmware, Activity, Overview) */}
        <div className="flex flex-col gap-16 pb-16">
          
          {/* Firmware Breakdown */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-6">Firmware Versions</h2>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="h-48 w-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={firmwareBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={80}
                      paddingAngle={3} dataKey="value" stroke="none"
                    >
                      {firmwareBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={FIRMWARE_COLORS[index % FIRMWARE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '4px', fontSize: '12px' }}
                      itemStyle={{ color: '#F2F2F2', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                  <span className="text-[9px] text-[#9A9A9A] uppercase tracking-widest font-bold">Total</span>
                  <span className="text-xl font-bold text-light-text dark:text-[#F2F2F2]">
                    {firmwareBreakdown.reduce((acc, curr) => acc + curr.value, 0)}
                  </span>
                </div>
              </div>
              <div className="flex-1 flex gap-8">
                {firmwareBreakdown.map((item, index) => (
                  <div key={item.name} className="flex flex-col text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FIRMWARE_COLORS[index % FIRMWARE_COLORS.length] }} />
                      <span className="text-light-text-secondary dark:text-[#9A9A9A] font-medium">{item.name}</span>
                    </div>
                    <span className="text-2xl font-bold pl-5">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-6">Recent Activity</h2>
            <div className="flex flex-col gap-4">
              {recentActivity.length === 0 ? (
                <div className="py-10 text-center">
                  <Activity size={24} className="mx-auto text-gray-300 dark:text-[#333] mb-3" />
                  <p className="text-sm text-light-text-secondary dark:text-[#9A9A9A]">No recent activity</p>
                </div>
              ) : recentActivity.slice(0, 5).map(event => {
                let badgeColor = '';
                let label = '';
                let onClick = () => {};
                
                if (event.type === 'alarm') {
                  label = 'ALARM';
                  badgeColor = event.severity === 'critical' ? 'bg-[#C4453D]/10 text-[#C4453D]' : 'bg-[#D99B3F]/10 text-[#D99B3F]';
                  onClick = () => onViewAlarm(event.alarmId!);
                } else if (event.type === 'command') {
                  label = 'COMMAND';
                  badgeColor = 'bg-[#7C8A94]/10 text-[#7C8A94]';
                  onClick = () => onViewCommand(event.deviceId!);
                } else if (event.type === 'connectivity') {
                  label = 'CONNECTIVITY';
                  const isOnline = event.text.toLowerCase().includes('online');
                  badgeColor = isOnline ? 'bg-[#1B7A6E]/10 text-[#1B7A6E]' : 'bg-[#C4453D]/10 text-[#C4453D]';
                  onClick = () => onViewDevice(event.deviceId!);
                }

                return (
                  <button 
                    key={event.id}
                    onClick={onClick}
                    className="w-full text-left py-2 hover:opacity-80 transition-opacity outline-none flex items-start gap-4"
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm w-28 text-center shrink-0 ${badgeColor}`}>
                      {label}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-light-text dark:text-[#F2F2F2] line-clamp-1">{event.text}</p>
                    </div>
                    <span className="text-xs text-light-text-secondary dark:text-[#9A9A9A] whitespace-nowrap">{event.timestamp}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
