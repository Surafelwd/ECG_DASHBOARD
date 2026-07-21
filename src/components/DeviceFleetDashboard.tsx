import React, { useState } from 'react';
import { 
  Activity, Server, Wifi, WifiOff, AlertTriangle, Terminal, DownloadCloud,
  ChevronRight, Laptop, Bell, ArrowRight, Search
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

// Removed mock data
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
  availableDevices?: {id: string}[];
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
  
  const [connTimeRange, setConnTimeRange] = useState('24H');
  const [alarmTimeRange, setAlarmTimeRange] = useState('24H');
  const [searchQuery, setSearchQuery] = useState('');

  // Compute real metrics from availableDevices if metricsData not provided
  const computedMetrics = metricsData || {
    totalDevices: availableDevices.length,
    online: availableDevices.filter((d: any) => d.connectivityStatus === 'Online').length,
    offline: availableDevices.filter((d: any) => d.connectivityStatus !== 'Online').length,
    activeAlarms: 0,
    commandsToday: 0,
    firmwareUpdatesPending: availableDevices.filter((d: any) => d.firmwareUpdateAvailable).length
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 h-full">
        <div className="w-8 h-8 border-2 border-[#1B7A6E]/30 border-t-[#1B7A6E] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-light-bg dark:bg-[#000000] text-light-text dark:text-dark-text overflow-auto">
      <div className="px-6 py-4 space-y-4 max-w-[1600px] mx-auto w-full">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight">System Overview</h1>
            <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] mt-1">
              Welcome back, {userName}. Here is the current status of the device fleet.
            </p>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-[#9A9A9A] pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search devices..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 pl-9 pr-4 py-2 bg-white dark:bg-[#121212] border border-gray-300 dark:border-[#333] rounded-sm text-sm outline-none focus:ring-1 focus:ring-[#1B7A6E]"
            />
            {searchQuery && (
              <div className="absolute top-full right-0 mt-1 w-full bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm shadow-xl z-50 max-h-60 overflow-y-auto py-1">
                {availableDevices.filter(d => d.id.toLowerCase().includes(searchQuery.toLowerCase())).map(d => (
                  <button
                    key={d.id}
                    onClick={() => {
                      onSearchDevice(d.id);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-light-text dark:text-[#F2F2F2]"
                  >
                    {d.id}
                  </button>
                ))}
                {availableDevices.filter(d => d.id.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-sm text-light-text-secondary dark:text-[#9A9A9A]">
                    No devices found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <button 
            onClick={() => onMetricClick('total-devices')}
            className="flex flex-col p-4 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm text-left hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer"
          >
            <div className="flex items-center text-light-text-secondary dark:text-[#9A9A9A] mb-2">
              <Server size={16} className="mr-2" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Devices</span>
            </div>
            <div className="text-2xl font-bold">{computedMetrics.totalDevices}</div>
          </button>
          
          <button 
            onClick={() => onMetricClick('online')}
            className="flex flex-col p-4 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm text-left hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer"
          >
            <div className="flex items-center text-[#1B7A6E] mb-2">
              <Wifi size={16} className="mr-2" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Devices Online</span>
            </div>
            <div className="text-2xl font-bold text-[#1B7A6E]">{computedMetrics.online}</div>
          </button>

          <button 
            onClick={() => onMetricClick('offline')}
            className="flex flex-col p-4 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm text-left hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer"
          >
            <div className="flex items-center text-[#C4453D] mb-2">
              <WifiOff size={16} className="mr-2" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Devices Offline</span>
            </div>
            <div className="text-2xl font-bold text-[#C4453D]">{computedMetrics.offline}</div>
          </button>

          <button 
            onClick={() => onMetricClick('active-alarms')}
            className="flex flex-col p-4 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm text-left hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer"
          >
            <div className={`flex items-center mb-2 ${computedMetrics.activeAlarms > 0 ? 'text-[#C4453D]' : 'text-light-text-secondary dark:text-[#9A9A9A]'}`}>
              <AlertTriangle size={16} className="mr-2" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Active Alarms</span>
            </div>
            <div className={`text-2xl font-bold ${computedMetrics.activeAlarms > 0 ? 'text-[#C4453D]' : 'text-light-text dark:text-[#F2F2F2]'}`}>
              {computedMetrics.activeAlarms}
            </div>
          </button>

          <button 
            onClick={() => onMetricClick('commands-today')}
            className="flex flex-col p-4 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm text-left hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer"
          >
            <div className="flex items-center text-[#7C8A94] mb-2">
              <Terminal size={16} className="mr-2" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Commands Sent</span>
            </div>
            <div className="text-2xl font-bold">{computedMetrics.commandsToday}</div>
          </button>

          <button 
            onClick={() => onMetricClick('firmware-pending')}
            className="flex flex-col p-4 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm text-left hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer"
          >
            <div className="flex items-center text-[#D99B3F] mb-2">
              <DownloadCloud size={16} className="mr-2" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Updates Pending</span>
            </div>
            <div className="text-2xl font-bold text-[#D99B3F]">{computedMetrics.firmwareUpdatesPending}</div>
          </button>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Connectivity Trend */}
          <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest">Device Connectivity</h2>
              <div className="flex gap-4">
                {['24H', '7D', '30D'].map(range => (
                  <button 
                    key={range}
                    onClick={() => setConnTimeRange(range)}
                    className={`text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-[#1a1a1a] transition-colors ${connTimeRange === range ? 'border-[#1B7A6E] text-[#1B7A6E]' : 'border-transparent text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={connectivityTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="time" stroke="#666" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#121212', borderColor: '#262626', borderRadius: '2px', fontSize: '12px' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />
                  <Line name="Online" type="monotone" dataKey="online" stroke="#1B7A6E" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line name="Offline" type="monotone" dataKey="offline" stroke="#C4453D" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alarm Trend */}
          <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest">Alarm Activity</h2>
              <div className="flex gap-4">
                {['24H', '7D', '30D'].map(range => (
                  <button 
                    key={range}
                    onClick={() => setAlarmTimeRange(range)}
                    className={`text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-[#1a1a1a] transition-colors ${alarmTimeRange === range ? 'border-[#1B7A6E] text-[#1B7A6E]' : 'border-transparent text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={alarmTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="time" stroke="#666" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#121212', borderColor: '#262626', borderRadius: '2px', fontSize: '12px', color: '#F2F2F2' }}
                    itemStyle={{ fontWeight: 'bold' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />
                  <Bar name="Critical" dataKey="critical" stackId="a" fill="#C4453D" />
                  <Bar name="Warning" dataKey="warning" stackId="a" fill="#D99B3F" />
                  <Bar name="Info" dataKey="info" stackId="a" fill="#7C8A94" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Lower Row: Firmware, Activity, Quick Links */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Firmware Breakdown */}
          <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm p-6 flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-6">Firmware Versions</h2>
            <div className="h-48 flex-1 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={firmwareBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {firmwareBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={FIRMWARE_COLORS[index % FIRMWARE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#121212', borderColor: '#262626', borderRadius: '2px', fontSize: '12px' }}
                    itemStyle={{ color: '#F2F2F2', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                <span className="text-[10px] text-[#9A9A9A] uppercase tracking-widest font-bold">Total</span>
                <span className="text-xl font-bold text-light-text dark:text-[#F2F2F2]">
                  {firmwareBreakdown.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {firmwareBreakdown.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center">
                    <div className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: FIRMWARE_COLORS[index % FIRMWARE_COLORS.length] }}></div>
                    <span className="text-light-text-secondary dark:text-[#9A9A9A]">{item.name}</span>
                  </div>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-[#262626] flex items-center justify-between bg-gray-50 dark:bg-[#0a0a0a]">
              <h2 className="text-xs font-bold uppercase tracking-widest">Recent Activity</h2>
            </div>
            <div className="flex-1 overflow-auto max-h-[320px] divide-y divide-gray-100 dark:divide-[#1a1a1a]">
              {recentActivity.map(event => {
                let badgeColor = '';
                let label = '';
                let onClick = () => {};
                
                if (event.type === 'alarm') {
                  label = 'ALARM';
                  badgeColor = event.severity === 'critical' ? 'bg-[#C4453D]/10 text-[#C4453D] border-[#C4453D]/20' : 'bg-[#D99B3F]/10 text-[#D99B3F] border-[#D99B3F]/20';
                  onClick = () => onViewAlarm(event.alarmId!);
                } else if (event.type === 'command') {
                  label = 'COMMAND';
                  badgeColor = 'bg-[#7C8A94]/10 text-[#7C8A94] border-[#7C8A94]/20';
                  onClick = () => onViewCommand(event.deviceId!);
                } else if (event.type === 'connectivity') {
                  label = 'CONNECTIVITY';
                  const isOnline = event.text.includes('online');
                  badgeColor = isOnline ? 'bg-[#1B7A6E]/10 text-[#1B7A6E] border-[#1B7A6E]/20' : 'bg-[#C4453D]/10 text-[#C4453D] border-[#C4453D]/20';
                  onClick = () => onViewDevice(event.deviceId!);
                }

                return (
                  <button 
                    key={event.id}
                    onClick={onClick}
                    className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-[#1a1a1a] group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${badgeColor}`}>
                        {label}
                      </span>
                      <span className="text-[10px] text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider">{event.timestamp}</span>
                    </div>
                    <p className="text-xs text-light-text dark:text-[#F2F2F2] group-hover:text-[#1B7A6E] transition-colors line-clamp-2">
                      {event.text}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-between">
              <button 
                onClick={onNavigateToAlarms}
                className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm px-1 cursor-pointer"
              >
                All Alarms &rarr;
              </button>
              <button 
                onClick={onNavigateToDevices}
                className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm px-1 cursor-pointer"
              >
                All Devices &rarr;
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-2">Quick Links</h2>
            
            <button 
              onClick={onNavigateToDevices}
              className="flex items-center p-4 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm hover:border-[#1B7A6E] transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-sm bg-[#1B7A6E]/10 flex items-center justify-center mr-4 shrink-0 text-[#1B7A6E]">
                <Laptop size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold uppercase tracking-widest mb-1 group-hover:text-[#1B7A6E] transition-colors">Devices</div>
                <div className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">View and manage all devices</div>
              </div>
              <ChevronRight size={18} className="text-gray-400 dark:text-[#666] group-hover:text-[#1B7A6E]" />
            </button>

            <button 
              onClick={onNavigateToAlarms}
              className="flex items-center p-4 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm hover:border-[#1B7A6E] transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-sm bg-[#C4453D]/10 flex items-center justify-center mr-4 shrink-0 text-[#C4453D]">
                <Bell size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-bold uppercase tracking-widest group-hover:text-[#1B7A6E] transition-colors">Alarms</div>
                  {computedMetrics.activeAlarms > 0 && (
                    <span className="bg-[#C4453D] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">{computedMetrics.activeAlarms}</span>
                  )}
                </div>
                <div className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">Review active alarms</div>
              </div>
              <ChevronRight size={18} className="text-gray-400 dark:text-[#666] group-hover:text-[#1B7A6E]" />
            </button>

            <div className="mt-auto">
              <div className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-2">Recently Managed</div>
              {recentlyManagedDevice ? (
                <button 
                  onClick={() => onNavigateToCommandCenter(recentlyManagedDevice.deviceId)}
                  className="w-full flex flex-col p-4 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1a1a1a] rounded-sm hover:border-[#1B7A6E] hover:bg-light-card dark:hover:bg-[#121212] transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer text-left"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-light-text dark:text-[#F2F2F2] group-hover:text-[#1B7A6E] transition-colors">{recentlyManagedDevice.deviceId}</span>
                    <Terminal size={14} className="text-gray-400 dark:text-[#666] group-hover:text-[#1B7A6E]" />
                  </div>
                  <span className="text-[11px] text-light-text-secondary dark:text-[#9A9A9A] font-mono">{recentlyManagedDevice.serialNumber}</span>
                  <div className="mt-3 flex items-center text-[10px] font-bold uppercase tracking-widest text-[#1B7A6E]">
                    Continue managing <ArrowRight size={12} className="ml-1" />
                  </div>
                </button>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1a1a1a] rounded-sm text-center">
                  <span className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">No recent activity</span>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
