import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, AlertCircle, Info, Clock, CheckCircle, XCircle, 
  Search, Filter, X, ChevronRight, User, Activity, Bell, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer 
} from 'recharts';

// --- HELPERS ---
const formatElapsedTime = (timestamp: string) => {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ${diffMins % 60}m ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ${diffHrs % 24}h ago`;
};

const formatDate = (timestamp: string) => {
  return new Date(timestamp).toLocaleString(undefined, { 
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
};

const getSeverityStyles = (severity: string) => {
  switch (severity) {
    case 'Critical': return { color: '#C4453D', bg: 'bg-[#C4453D]/10', icon: AlertTriangle };
    case 'Warning': return { color: '#D99B3F', bg: 'bg-[#D99B3F]/10', icon: AlertCircle };
    default: return { color: '#7C8A94', bg: 'bg-[#7C8A94]/10', icon: Info };
  }
};

// --- COMPONENTS ---

interface AlarmDetailPanelProps {
  alarm: any;
  onClose: () => void;
  onViewDevice: (id: string) => void;
  staffList: any[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string, note: string) => void;
  onReopen: (id: string) => void;
  onAssign: (id: string, staffId: string) => void;
}

function AlarmDetailPanel({ 
  alarm, onClose, onViewDevice, staffList, 
  onAcknowledge, onResolve, onReopen, onAssign 
}: AlarmDetailPanelProps) {
  const [resolveNote, setResolveNote] = useState('');
  const SeverityIcon = getSeverityStyles(alarm.severity).icon;
  const sevColor = getSeverityStyles(alarm.severity).color;

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white dark:bg-[#121212] border-l border-gray-200 dark:border-[#262626] shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-[#262626]">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-sm ${getSeverityStyles(alarm.severity).bg}`}>
            <SeverityIcon size={20} style={{ color: sevColor }} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-light-text dark:text-dark-text tracking-tight">
              {alarm.alarmType}
            </h2>
            <div className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-[#9A9A9A] mt-1">
              <span>ID: {alarm.id}</span>
              <span>•</span>
              <button onClick={() => onViewDevice(alarm.deviceId)} className="hover:text-[#1B7A6E] font-medium transition-colors outline-none focus-visible:underline">
                Device: {alarm.deviceId}
              </button>
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
        >
          <X size={20} />
        </button>
      </div>

      {/* Action Bar */}
      <div className="p-4 md:px-6 bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-[#262626] flex flex-wrap gap-2">
        {alarm.status === 'Active' && (
          <button 
            onClick={() => onAcknowledge(alarm.id)}
            className="px-4 py-2 bg-[#1B7A6E] text-white rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-[#145F56] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B7A6E]"
          >
            Acknowledge
          </button>
        )}
        
        {alarm.status === 'Acknowledged' && (
          <div className="flex w-full md:w-auto gap-2">
            <input 
              type="text" 
              placeholder="Resolution note..." 
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              className="flex-1 px-3 py-2 bg-white dark:bg-[#121212] border border-gray-300 dark:border-[#333] rounded-sm text-sm outline-none focus:ring-1 focus:ring-[#1B7A6E]"
            />
            <button 
              onClick={() => onResolve(alarm.id, resolveNote || 'Resolved without note')}
              className="px-4 py-2 bg-gray-200 dark:bg-[#262626] text-light-text dark:text-dark-text rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-gray-300 dark:hover:bg-[#333] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
            >
              Resolve
            </button>
          </div>
        )}

        {alarm.status === 'Resolved' && (
          <button 
            onClick={() => onReopen(alarm.id)}
            className="px-4 py-2 bg-gray-200 dark:bg-[#262626] text-light-text dark:text-dark-text rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-gray-300 dark:hover:bg-[#333] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
          >
            Reopen Alarm
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        {/* Status & Assignment */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] p-4 rounded-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-1">Current Status</span>
            <span className={`text-sm font-bold ${
              alarm.status === 'Active' ? 'text-[#C4453D]' : 
              alarm.status === 'Acknowledged' ? 'text-[#D99B3F]' : 
              'text-[#1B7A6E]'
            }`}>
              {alarm.status}
            </span>
          </div>
          <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] p-4 rounded-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-2 block">Assigned To</span>
            {alarm.status !== 'Resolved' ? (
              <select 
                value={alarm.assignedTo || ''}
                onChange={(e) => onAssign(alarm.id, e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-sm text-sm outline-none focus:ring-1 focus:ring-[#1B7A6E]"
              >
                <option value="">Unassigned</option>
                {staffList.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-medium text-light-text dark:text-dark-text">
                {alarm.assignedTo ? staffList.find(s => s.id === alarm.assignedTo)?.name : 'Unassigned'}
              </span>
            )}
          </div>
        </div>

        {/* Trigger Data */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-3">Trigger Data</h3>
          <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm p-4">
            <dl className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">Triggered</dt>
                <dd className="col-span-2 text-sm font-medium text-light-text dark:text-dark-text">{formatDate(alarm.triggeredAt)} ({formatElapsedTime(alarm.triggeredAt)})</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">Severity</dt>
                <dd className="col-span-2 text-sm font-medium" style={{ color: sevColor }}>{alarm.severity}</dd>
              </div>
              {Object.entries(alarm.triggerData || {}).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-[#262626]">
                  <dt className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">{key}</dt>
                  <dd className="col-span-2 text-sm font-medium text-light-text dark:text-dark-text">{value as React.ReactNode}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Signal Snapshot */}
        {alarm.signalSnapshot && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-3 flex items-center justify-between">
              Signal Snapshot
              <span className="text-[10px] normal-case tracking-normal">At time of trigger</span>
            </h3>
            <div className="h-40 bg-[#121212] border border-[#262626] rounded-sm p-4 relative overflow-hidden">
              <div className="absolute inset-0 grid grid-cols-10 grid-rows-4 pointer-events-none opacity-20">
                {Array.from({length: 40}).map((_, i) => (
                  <div key={i} className="border-r border-b border-[#3ADB8F]" />
                ))}
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={alarm.signalSnapshot} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3ADB8F" 
                    strokeWidth={1.5} 
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Audit Log / History */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-3">Audit Log</h3>
          <div className="space-y-4 border-l-2 border-gray-200 dark:border-[#262626] ml-2 pl-4">
            {alarm.history?.map((entry: any, i: number) => (
              <div key={i} className="relative">
                <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-[#444] border-2 border-white dark:border-[#121212]" />
                <div className="text-sm font-medium text-light-text dark:text-dark-text">{entry.action}</div>
                <div className="text-xs text-light-text-secondary dark:text-[#9A9A9A] mt-0.5">
                  by {entry.user} • {formatDate(entry.timestamp)}
                </div>
                {entry.note && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#262626] rounded-sm text-sm text-light-text-secondary dark:text-[#9A9A9A] italic">
                    "{entry.note}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

export interface AlarmPageProps {
  userName?: string;
  userRole?: string;
  alarms?: any[];
  escalationThresholdMinutes?: number;
  isLoading?: boolean;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string, note: string) => void;
  onReopen?: (id: string) => void;
  onAssign?: (id: string, staffId: string) => void;
  onViewDevice?: (deviceId: string) => void;
  staffList?: any[];
}

export default function AlarmPage({
  userName = 'Admin',
  userRole = 'Administrator',
  alarms = [],
  escalationThresholdMinutes = 15,
  isLoading = false,
  onAcknowledge = () => {},
  onResolve = () => {},
  onReopen = () => {},
  onAssign = () => {},
  onViewDevice = () => {},
  staffList = []
}: AlarmPageProps) {
  
  const [activeTab, setActiveTab] = useState<'Active' | 'Acknowledged' | 'Resolved' | 'All'>('Active');
  
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  
  const [selectedAlarmId, setSelectedAlarmId] = useState<string | null>(null);

  // Time ticker to update elapsed times
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000); // 10s updates
    return () => clearInterval(timer);
  }, []);

  const normalizedAlarms = useMemo(() => {
    return alarms.map(a => ({
      ...a,
      id: a.id?.toString() || Math.random().toString(),
      deviceId: a.device_id || a.deviceId,
      severity: a.severity === 'warning' ? 'Warning' : a.severity === 'critical' ? 'Critical' : a.severity || 'Info',
      alarmType: a.subtype || a.event_type || a.alarmType || 'Event',
      triggeredAt: a.created_at || a.triggeredAt || new Date().toISOString(),
      status: a.status === 'unacknowledged' ? 'Active' : (a.status || 'Active'),
      triggerData: a.payload || a.triggerData || {},
      history: a.history || []
    }));
  }, [alarms]);

  const filteredAlarms = useMemo(() => {
    return normalizedAlarms.filter(a => {
      if (activeTab !== 'All' && a.status !== activeTab) return false;
      if (filterSeverity !== 'All' && a.severity !== filterSeverity) return false;
      if (filterType !== 'All' && a.alarmType !== filterType) return false;
      if (searchQuery && !a.deviceId?.toLowerCase().includes(searchQuery.toLowerCase()) && !a.id?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterDateStart && new Date(a.triggeredAt).getTime() < new Date(filterDateStart).getTime()) return false;
      if (filterDateEnd && new Date(a.triggeredAt).getTime() > new Date(filterDateEnd).getTime() + 86400000) return false; // Add 1 day to include end date
      return true;
    }).sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
  }, [normalizedAlarms, activeTab, filterSeverity, filterType, searchQuery, filterDateStart, filterDateEnd]);

  const counts = useMemo(() => {
    return {
      Active: normalizedAlarms.filter(a => a.status === 'Active').length,
      Acknowledged: normalizedAlarms.filter(a => a.status === 'Acknowledged').length,
      Resolved: normalizedAlarms.filter(a => a.status === 'Resolved').length,
      All: normalizedAlarms.length
    };
  }, [normalizedAlarms]);

  const selectedAlarm = normalizedAlarms.find(a => a.id === selectedAlarmId);

  // Full-page All Clear state
  if (counts.Active === 0 && counts.Acknowledged === 0 && activeTab === 'Active' && !searchQuery) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-light-bg dark:bg-[#000000] p-6 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="w-24 h-24 bg-[#1B7A6E]/10 rounded-full flex items-center justify-center mb-6 border-4 border-[#1B7A6E]/20"
        >
          <ShieldCheck size={48} className="text-[#1B7A6E]" />
        </motion.div>
        <h2 className="text-2xl font-bold uppercase tracking-tight text-light-text dark:text-[#F2F2F2] mb-2">
          All Clear
        </h2>
        <p className="text-sm text-light-text-secondary dark:text-[#9A9A9A] max-w-md mx-auto mb-8">
          There are no active or unacknowledged alarms in the system. The device fleet is operating normally.
        </p>
        <button 
          onClick={() => setActiveTab('All')}
          className="px-6 py-2.5 bg-gray-100 dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm text-xs font-bold uppercase tracking-widest text-light-text dark:text-[#F2F2F2] hover:border-[#1B7A6E] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
        >
          View Alarm History
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-light-bg dark:bg-[#000000] text-light-text dark:text-dark-text relative overflow-hidden">
      
      {/* Header & Tabs */}
      <div className="flex-none px-6 py-4 pb-0 border-b border-gray-200 dark:border-[#262626] bg-light-card dark:bg-[#121212] sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight mb-1 uppercase">Alarm Queue</h1>
            <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">
              Device and signal-level hardware events.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {(['Active', 'Acknowledged', 'Resolved', 'All'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-xs font-bold uppercase tracking-widest relative outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-t-sm whitespace-nowrap ${activeTab === tab ? 'text-[#1B7A6E]' : 'text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}
            >
              {tab}
              <span className={`ml-2 px-1.5 py-0.5 rounded-sm text-[10px] ${activeTab === tab ? 'bg-[#1B7A6E]/10 text-[#1B7A6E]' : 'bg-gray-100 dark:bg-[#1a1a1a]'}`}>
                {counts[tab]}
              </span>
              {activeTab === tab && (
                <motion.div layoutId="alarmTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B7A6E]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-[#9A9A9A] pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search Device / ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-[#121212] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] w-48"
          />
        </div>
        
        <select 
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-1.5 bg-gray-50 dark:bg-[#121212] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E]"
        >
          <option value="All">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="Warning">Warning</option>
          <option value="Info">Info</option>
        </select>

        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 bg-gray-50 dark:bg-[#121212] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E] max-w-[200px]"
        >
          <option value="All">All Alarm Types</option>
          <option value="Device Disconnected">Device Disconnected</option>
          <option value="Low Battery">Low Battery</option>
          <option value="Signal Lost">Signal Lost</option>
          <option value="Abnormal Signal Pattern">Abnormal Signal Pattern</option>
          <option value="Missed Transmission">Missed Transmission</option>
          <option value="Firmware Failure">Firmware Failure</option>
        </select>

        <div className="flex items-center gap-2">
          <input 
            type="date"
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
            className="px-2 py-1 bg-gray-50 dark:bg-[#121212] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E]"
          />
          <span className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">-</span>
          <input 
            type="date"
            value={filterDateEnd}
            onChange={(e) => setFilterDateEnd(e.target.value)}
            className="px-2 py-1 bg-gray-50 dark:bg-[#121212] border border-gray-300 dark:border-[#333] rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E]"
          />
        </div>

        {(searchQuery || filterSeverity !== 'All' || filterType !== 'All' || filterDateStart || filterDateEnd) && (
          <button 
            onClick={() => { setSearchQuery(''); setFilterSeverity('All'); setFilterType('All'); setFilterDateStart(''); setFilterDateEnd(''); }}
            className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-dark-text flex items-center outline-none focus-visible:underline rounded-sm"
          >
            <X size={14} className="mr-1" /> Clear
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-light-bg dark:bg-[#000000]">
        
        {filteredAlarms.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 bg-gray-100 dark:bg-[#1a1a1a] rounded-full flex items-center justify-center mb-4">
              <Search size={24} className="text-light-text-secondary dark:text-[#9A9A9A]" />
            </div>
            <h3 className="text-sm font-bold text-light-text dark:text-dark-text mb-2">No alarms match the current filters.</h3>
            <button 
              onClick={() => { setSearchQuery(''); setFilterSeverity('All'); setFilterType('All'); }}
              className="mt-2 text-xs font-bold uppercase tracking-widest text-[#1B7A6E] outline-none focus-visible:underline"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#1a1a1a]">
            {filteredAlarms.map((alarm) => {
              const Icon = getSeverityStyles(alarm.severity).icon;
              const sevColor = getSeverityStyles(alarm.severity).color;
              const isEscalated = alarm.status === 'Active' && 
                (now - new Date(alarm.triggeredAt).getTime() > escalationThresholdMinutes * 60000);
              
              return (
                <div 
                  key={alarm.id}
                  onClick={() => setSelectedAlarmId(alarm.id)}
                  className={`py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#0a0a0a] transition-colors group relative ${isEscalated ? 'pl-4 border-l-4 border-l-[#C4453D]' : 'pl-0'}`}
                >

                  
                  <div className="flex items-center gap-4 min-w-0 flex-1 relative z-10">
                    <div className="shrink-0 flex items-center justify-center w-8">
                      <Icon size={18} style={{ color: sevColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-light-text dark:text-dark-text truncate">{alarm.alarmType}</span>
                        <span className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">•</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onViewDevice(alarm.deviceId); }}
                          className="text-xs font-mono font-bold text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] dark:hover:text-[#1B7A6E] transition-colors outline-none focus-visible:underline"
                        >
                          {alarm.deviceId}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-light-text-secondary dark:text-[#9A9A9A]">
                        <span>{formatDate(alarm.triggeredAt)}</span>
                        
                        {alarm.status === 'Active' && (
                          <div className={`flex items-center gap-1 font-bold ${isEscalated ? 'text-[#C4453D]' : ''}`}>
                            <Clock size={10} />
                            {formatElapsedTime(alarm.triggeredAt)} elapsed
                            {isEscalated && <span className="ml-1 uppercase tracking-widest">(Escalated)</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 relative z-10">
                    <div className="flex items-center gap-2">
                      {alarm.assignedTo && (
                        <div className="hidden sm:flex items-center text-xs text-light-text-secondary dark:text-[#9A9A9A]">
                          <User size={12} className="mr-1" /> {staffList.find(s => s.id === alarm.assignedTo)?.name || 'Assigned'}
                        </div>
                      )}
                      <span className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${
                        alarm.status === 'Active' ? 'bg-[#C4453D]/10 text-[#C4453D]' : 
                        alarm.status === 'Acknowledged' ? 'bg-[#D99B3F]/10 text-[#D99B3F]' : 
                        'bg-[#1B7A6E]/10 text-[#1B7A6E]'
                      }`}>
                        {alarm.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {alarm.status === 'Active' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAcknowledge(alarm.id); }}
                          className="px-3 py-1.5 bg-[#1B7A6E] hover:bg-[#145F56] text-white rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] shadow-sm"
                        >
                          Quick Ack
                        </button>
                      )}
                      <ChevronRight size={16} className="text-light-text-secondary dark:text-[#9A9A9A] group-hover:text-[#1B7A6E] transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-in Detail Panel */}
      <AnimatePresence>
        {selectedAlarm && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setSelectedAlarmId(null)}
            />
            <AlarmDetailPanel 
              alarm={selectedAlarm} 
              onClose={() => setSelectedAlarmId(null)} 
              onViewDevice={(id) => { setSelectedAlarmId(null); onViewDevice(id); }}
              staffList={staffList}
              onAcknowledge={onAcknowledge}
              onResolve={(id, note) => { onResolve(id, note); setSelectedAlarmId(null); }}
              onReopen={onReopen}
              onAssign={onAssign}
            />
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
