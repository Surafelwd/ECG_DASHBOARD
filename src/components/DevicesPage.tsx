import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, X, Signal, SignalZero, SignalLow, SignalMedium, SignalHigh,
  Battery, BatteryFull, BatteryLow, BatteryMedium, AlertTriangle, ArrowLeft, Download, 
  Activity, Clock, User, Hash, HardDrive, Wifi, WifiOff, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';

// Removed mock data

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
const StatusBadge = ({ isOnline }: { isOnline: boolean }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${
    isOnline 
      ? 'bg-[#1B7A6E]/10 text-[#1B7A6E] border border-[#1B7A6E]/20' 
      : 'bg-[#C4453D]/10 text-[#C4453D] border border-[#C4453D]/20'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-[#1B7A6E]' : 'bg-[#C4453D]'}`}></span>
    {isOnline ? 'Online' : 'Offline'}
  </span>
);

const BatteryIndicator = ({ level }: { level: number }) => {
  let color = 'text-[#1B7A6E]';
  if (level <= 20) color = 'text-[#C4453D]';
  else if (level <= 50) color = 'text-[#D99B3F]';

  return (
    <div className="flex items-center space-x-1.5">
      <div className={`w-6 h-3 border border-current rounded-[2px] p-[1px] relative ${color}`}>
        <div className="h-full bg-current" style={{ width: `${level}%` }}></div>
        <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[1px] h-1.5 bg-current rounded-r-sm"></div>
      </div>
      <span className="text-xs font-semibold text-light-text dark:text-dark-text">{level}%</span>
    </div>
  );
};

const SignalIndicator = ({ strength }: { strength: number }) => {
  let Icon = Signal;
  if (strength === 0) Icon = SignalZero;
  else if (strength === 1) Icon = SignalLow;
  else if (strength === 2) Icon = SignalMedium;
  else if (strength >= 3) Icon = SignalHigh;

  const color = strength > 0 ? 'text-[#1B7A6E]' : 'text-gray-400 dark:text-gray-600';
  
  return <Icon className={color} size={16} />;
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

// --- MAIN PAGE ---
export default function DevicesPage({
  userRole = 'administrator',
  devices = [],
  isLoading = false,
  getDeviceDetail = defaultGetDeviceDetail,
  onManageCommands = () => {},
  onExportReadings = (deviceId: string, detailData: any) => {
    if (!detailData || !detailData.readings) return;
    const header = ['Timestamp', 'Session ID', 'ECG Ch1 (mV)', 'ECG Ch2 (mV)', 'Accel X (mg)', 'Accel Y (mg)', 'Accel Z (mg)'];
    const rows = detailData.readings.map((r: any) => [
      `"${r.timestamp}"`, `"${r.sessionId}"`, r.ecgCh1, r.ecgCh2, r.accelX, r.accelY, r.accelZ
    ]);
    const csvContent = [header.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry-${deviceId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
  onClearFilters = () => {},
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setSelectedDeviceId(initialSelectedDeviceId);
    setCurrentPage(1);
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

  const filteredDevices = devices.filter(d => {
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
             d.serialNumber.toLowerCase().includes(q) || 
             d.ownerName.toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueFirmwares = Array.from(new Set(devices.map(d => d.firmwareVersion))).filter(Boolean);

  // --- RENDER LIST VIEW ---
  if (!selectedDeviceId) {
    return (
      <div className="h-full flex flex-col bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text overflow-hidden">
        
        {/* Header & Filter Bar */}
        <div className="flex-none px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-light-card dark:bg-dark-card space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold uppercase tracking-tight">Device Fleet</h1>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Manage and monitor active devices.</p>
            </div>
            <div className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest bg-gray-100 dark:bg-[#1a1a1a] px-2 py-1 rounded-sm border border-gray-200 dark:border-[#333]">
              Total: {devices.length} Devices
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={14} />
              <input 
                type="text" 
                placeholder="Search by ID, Serial, or Owner..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#000000] border border-gray-300 dark:border-dark-border rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] focus:border-transparent transition-all"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 bg-white dark:bg-[#000000] border border-gray-300 dark:border-dark-border rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] cursor-pointer min-w-[120px]"
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
                className="px-2 py-1.5 bg-white dark:bg-[#000000] border border-gray-300 dark:border-dark-border rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] cursor-pointer hidden sm:block min-w-[120px]"
              >
                <option value="All Firmware">All Firmware</option>
                {uniqueFirmwares.map(fw => <option key={fw as string} value={fw as string}>{fw as string}</option>)}
              </select>

              {(searchQuery || statusFilter !== 'All' || firmwareFilter !== 'All Firmware') && (
                <button 
                  onClick={handleClearFilters}
                  className="px-3 py-1.5 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest hover:text-[#1B7A6E] dark:hover:text-[#1B7A6E] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#1B7A6E] whitespace-nowrap cursor-pointer flex items-center"
                >
                  <X size={12} className="mr-1" /> Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Device Table / List */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-[#121212] border border-gray-200 dark:border-dark-border rounded-sm animate-pulse"></div>
              ))}
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Filter className="text-gray-300 dark:text-gray-600 mb-4" size={48} />
              <h3 className="text-lg font-bold mb-2">No devices match filters</h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-sm mb-6">
                Try adjusting your search query or changing the filter options to see more results.
              </p>
              <button onClick={handleClearFilters} className="px-4 py-2 bg-gray-100 dark:bg-[#1a1a1a] text-xs font-bold uppercase tracking-widest border border-gray-300 dark:border-[#333] rounded-sm hover:bg-gray-200 dark:hover:bg-[#262626] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]">
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-dark-border rounded-sm bg-light-card dark:bg-dark-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-dark-border text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Device / Serial</th>
                      <th className="px-6 py-4">Owner</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Battery</th>
                      <th className="px-6 py-4 hidden md:table-cell">Signal</th>
                      <th className="px-6 py-4 hidden lg:table-cell">Firmware</th>
                      <th className="px-6 py-4">Last Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                    {filteredDevices.map(device => (
                      <tr 
                        key={device.id}
                        onClick={() => setSelectedDeviceId(device.id)}
                        tabIndex={0}
                        className={`hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1B7A6E] ${device.connectivityStatus === 'Offline' ? 'border-l-4 border-l-[#C4453D]' : 'border-l-4 border-l-transparent'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-light-text dark:text-dark-text">{device.id}</div>
                          <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{device.serialNumber}</div>
                        </td>
                        <td className="px-6 py-4">
                          {device.ownerName ? (
                            <span className="font-medium">{device.ownerName}</span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge isOnline={device.connectivityStatus === 'Online'} />
                        </td>
                        <td className="px-6 py-4">
                          <BatteryIndicator level={device.batteryLevel} />
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <SignalIndicator strength={device.signalStrength} />
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <div className="flex items-center space-x-2">
                            <span>{device.firmwareVersion}</span>
                            {device.firmwareUpdateAvailable && (
                              <span className="w-2 h-2 rounded-full bg-[#D99B3F]" title="Update Available"></span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          {device.lastSync}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
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
    <div className="h-full flex flex-col bg-light-bg dark:bg-[#000000] text-light-text dark:text-dark-text overflow-hidden">
      
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
            <button 
              onClick={() => onManageCommands(device.id)}
              className="px-5 py-2.5 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer"
            >
              Manage Commands
            </button>
            {device.connectivityStatus === 'Online' && (
              <div className="w-2.5 h-2.5 rounded-full bg-[#1B7A6E] animate-pulse"></div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isDetailLoading || !detailData ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-[#1B7A6E]/30 border-t-[#1B7A6E] rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Telemetry Access */}
            <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm p-6 flex flex-col items-center justify-center text-center mb-6">
              <Activity size={32} className="text-[#1B7A6E] mb-3" />
              <h2 className="text-sm font-bold uppercase tracking-widest mb-2 text-light-text dark:text-dark-text">Live Telemetry Available</h2>
              <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] max-w-md mb-4">
                Access the dedicated real-time sensor telemetry dashboard for this device.
              </p>
              <button 
                onClick={() => onViewTelemetry?.(device.id)}
                className="px-6 py-2 bg-white dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] text-light-text dark:text-[#F2F2F2] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
              >
                Open Telemetry Dashboard
              </button>
            </div>

            {/* Signal Analysis Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold uppercase tracking-widest">Signal Analysis</h2>
                  <div className="flex bg-gray-100 dark:bg-[#1a1a1a] rounded-sm p-1 border border-gray-200 dark:border-[#333]">
                    {['24H', '7D', '30D'].map(range => (
                      <button key={range} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer ${range === '24H' ? 'bg-white dark:bg-[#262626] text-light-text dark:text-[#F2F2F2] shadow-sm' : 'text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}>
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-[#1a1a1a] rounded-sm">
                    <p className="text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider mb-1">Avg Signal Rate</p>
                    <p className="text-xl font-bold">{detailData.signalAnalysis.averageSignalRate}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-[#1a1a1a] rounded-sm">
                    <p className="text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider mb-1">Data Completeness</p>
                    <p className="text-xl font-bold">{detailData.signalAnalysis.dataCompleteness}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-100 dark:border-[#1a1a1a] rounded-sm">
                    <p className="text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider mb-1">Total Readings</p>
                    <p className="text-xl font-bold">{detailData.signalAnalysis.totalReadings}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-[#0a0a0a] border border-[#C4453D]/20 rounded-sm">
                    <p className="text-[10px] font-bold text-[#C4453D] uppercase tracking-wider mb-1">Motion Incidents</p>
                    <p className="text-xl font-bold text-[#C4453D]">{detailData.signalAnalysis.motionIncidents}</p>
                  </div>
                </div>

                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={detailData.signalAnalysis.trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                      <XAxis dataKey="time" stroke="#666" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis stroke="#666" tick={{ fill: '#9A9A9A', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#121212', borderColor: '#262626', borderRadius: '2px', fontSize: '12px' }}
                        itemStyle={{ color: '#1B7A6E', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="rate" stroke="#1B7A6E" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#1B7A6E' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm p-6 flex flex-col">
                <h2 className="text-sm font-bold uppercase tracking-widest mb-6">Motion Artifacts</h2>
                {detailData.motionArtifactFlags.length > 0 ? (
                  <div className="space-y-3 flex-1 overflow-auto pr-2">
                    {detailData.motionArtifactFlags.map((flag, idx) => (
                      <div key={idx} className="p-3 border-l-2 border-[#D99B3F] bg-[#D99B3F]/10 rounded-r-sm cursor-pointer hover:bg-[#D99B3F]/20 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-light-text dark:text-[#F2F2F2]">{flag.timestamp}</span>
                          <span className="text-[10px] font-bold bg-[#D99B3F]/20 text-[#D99B3F] px-1.5 py-0.5 rounded-sm">{flag.duration}</span>
                        </div>
                        <p className="text-xs text-[#D99B3F]">{flag.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <p className="text-sm text-light-text-secondary dark:text-[#9A9A9A]">No artifacts detected in this period.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sessions & Readings List */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a]">
                  <h2 className="text-xs font-bold uppercase tracking-widest">Reading Sessions</h2>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-[#1a1a1a] overflow-auto max-h-[400px]">
                  {detailData.readingSessions.map(session => (
                    <div key={session.id} className="p-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] cursor-pointer transition-colors outline-none focus-visible:bg-[#1a1a1a] group" tabIndex={0}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold group-hover:text-[#1B7A6E] transition-colors">{session.id}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${
                          session.type === 'Scheduled' ? 'border-[#1B7A6E]/30 text-[#1B7A6E] bg-[#1B7A6E]/10' :
                          session.type === 'Alarm' ? 'border-[#C4453D]/30 text-[#C4453D] bg-[#C4453D]/10' :
                          'border-gray-500/30 text-gray-500 bg-gray-500/10'
                        }`}>{session.type}</span>
                      </div>
                      <div className="text-[11px] text-light-text-secondary dark:text-[#9A9A9A] space-y-1">
                        <div>{session.start}</div>
                        <div>{session.samples} samples</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-3 bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-sm font-bold uppercase tracking-widest flex items-center">
                    <HardDrive size={16} className="mr-2 text-[#1B7A6E]" />
                    Raw ECG Data Browser
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-light-text-secondary dark:text-[#9A9A9A] hidden sm:inline-block">
                      Showing {detailData.readings.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, detailData.readings.length)} of {detailData.readings.length}
                    </span>
                    <button 
                      onClick={() => onExportReadings(device.id, detailData)}
                      className="flex items-center px-3 py-1.5 bg-[#1B7A6E]/10 hover:bg-[#1B7A6E]/20 text-[#1B7A6E] text-xs font-bold uppercase tracking-widest rounded-sm transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
                    >
                      <Download size={14} className="mr-1.5" /> Export CSV
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-[#262626] text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Session</th>
                        <th className="px-4 py-3">ECG Ch1 (mV)</th>
                        <th className="px-4 py-3">ECG Ch2 (mV)</th>
                        <th className="px-4 py-3 text-right">Accel X/Y/Z (g)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#1a1a1a] font-mono">
                      {detailData.readings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((reading: any) => (
                        <tr key={reading.id} className="hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors">
                          <td className="px-4 py-2.5 text-light-text dark:text-[#F2F2F2]">{reading.timestamp}</td>
                          <td className="px-4 py-2.5 text-light-text-secondary dark:text-[#9A9A9A]">{reading.sessionId}</td>
                          <td className="px-4 py-2.5 text-[#1B7A6E]">{reading.ecgCh1}</td>
                          <td className="px-4 py-2.5 text-[#1B7A6E]">{reading.ecgCh2}</td>
                          <td className="px-4 py-2.5 text-right text-light-text-secondary dark:text-[#666]">
                            {reading.accelX} / {reading.accelY} / {reading.accelZ}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-3 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-between sm:justify-end gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-sm hover:bg-gray-200 dark:hover:bg-[#262626] text-light-text-secondary dark:text-[#9A9A9A] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-xs font-bold px-2">Page {currentPage} of {Math.max(1, Math.ceil(detailData.readings.length / itemsPerPage))}</div>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(detailData.readings.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(detailData.readings.length / itemsPerPage)}
                    className="p-1.5 rounded-sm hover:bg-gray-200 dark:hover:bg-[#262626] text-light-text-secondary dark:text-[#9A9A9A] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

            </div>
          </>
        )}
      </div>

    </div>
  );
}
