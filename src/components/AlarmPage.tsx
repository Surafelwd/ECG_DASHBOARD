import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, AlertCircle, Info, Clock, CheckCircle, XCircle, 
  Search, Filter, X, ChevronRight, User, Activity, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer 
} from 'recharts';

// --- MOCK DATA ---
export const MOCK_STAFF_LIST = [
  { id: 'staff-1', name: 'Alice Smith' },
  { id: 'staff-2', name: 'Bob Jones' },
  { id: 'staff-3', name: 'Charlie Davis' },
];

export const MOCK_ALARM_DATA = [
  {
    id: 'ALM-1001',
    deviceId: 'DEV-0198',
    severity: 'Critical',
    alarmType: 'Signal Lost',
    triggeredAt: new Date(Date.now() - 8 * 60000).toISOString(), // 8 mins ago
    status: 'Active',
    assignedTo: null,
    triggerData: { 'Signal Strength': '0 bars', 'Duration': '45 sec', 'Last Known Location': 'Zone B' },
    signalSnapshot: Array.from({length: 20}).map((_, i) => ({ time: i, value: Math.sin(i/2) + (Math.random() * 0.1) })),
    history: [
      { timestamp: new Date(Date.now() - 8 * 60000).toISOString(), action: 'Triggered', user: 'System' }
    ]
  },
  {
    id: 'ALM-1002',
    deviceId: 'DEV-0199',
    severity: 'Warning',
    alarmType: 'Low Battery',
    triggeredAt: new Date(Date.now() - 25 * 60000).toISOString(),
    status: 'Active',
    assignedTo: null,
    triggerData: { 'Battery Level': '12%', 'Est. Time Remaining': '45 mins' },
    signalSnapshot: Array.from({length: 20}).map((_, i) => ({ time: i, value: 0.8 + (Math.random() * 0.1) })),
    history: [
      { timestamp: new Date(Date.now() - 25 * 60000).toISOString(), action: 'Triggered', user: 'System' }
    ]
  },
  {
    id: 'ALM-1003',
    deviceId: 'DEV-0200',
    severity: 'Info',
    alarmType: 'Abnormal Signal Pattern',
    triggeredAt: new Date(Date.now() - 120 * 60000).toISOString(),
    status: 'Acknowledged',
    assignedTo: 'staff-1',
    triggerData: { 'Pattern Type': 'Intermittent Noise', 'Frequency': 'High' },
    signalSnapshot: Array.from({length: 20}).map((_, i) => ({ time: i, value: Math.random() > 0.8 ? 0.9 : 0.2 })),
    history: [
      { timestamp: new Date(Date.now() - 120 * 60000).toISOString(), action: 'Triggered', user: 'System' },
      { timestamp: new Date(Date.now() - 110 * 60000).toISOString(), action: 'Acknowledged', user: 'Alice Smith' }
    ]
  },
  {
    id: 'ALM-1004',
    deviceId: 'DEV-0198',
    severity: 'Critical',
    alarmType: 'Device Disconnected',
    triggeredAt: new Date(Date.now() - 1440 * 60000).toISOString(),
    status: 'Resolved',
    assignedTo: 'staff-2',
    triggerData: { 'Connection Type': 'WiFi', 'Last Ping': '24 hrs ago' },
    signalSnapshot: Array.from({length: 20}).map((_, i) => ({ time: i, value: i < 10 ? 0.8 : 0 })),
    history: [
      { timestamp: new Date(Date.now() - 1440 * 60000).toISOString(), action: 'Triggered', user: 'System' },
      { timestamp: new Date(Date.now() - 1430 * 60000).toISOString(), action: 'Acknowledged', user: 'Bob Jones' },
      { timestamp: new Date(Date.now() - 1400 * 60000).toISOString(), action: 'Resolved', user: 'Bob Jones', note: 'Reconnected manually.' }
    ]
  }
];

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
                {alarm.deviceId}
              </button>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]">
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
        
        {/* Status Actions */}
        <div className="bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-sm border border-gray-200 dark:border-[#262626]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Current Status</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-sm ${
              alarm.status === 'Active' ? 'bg-[#C4453D]/10 text-[#C4453D]' : 
              alarm.status === 'Acknowledged' ? 'bg-[#D99B3F]/10 text-[#D99B3F]' : 
              'bg-[#1B7A6E]/10 text-[#1B7A6E]'
            }`}>
              {alarm.status}
            </span>
          </div>
          
          <div className="space-y-3">
            {alarm.status === 'Active' && (
              <button 
                onClick={() => onAcknowledge(alarm.id)}
                className="w-full py-2 bg-[#1B7A6E] hover:bg-[#1B7A6E]/90 text-white rounded-sm text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1B7A6E]"
              >
                Acknowledge Alarm
              </button>
            )}
            
            {(alarm.status === 'Active' || alarm.status === 'Acknowledged') && (
              <div className="space-y-2">
                <textarea 
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Resolution note (required)..."
                  className="w-full p-2 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-sm text-light-text dark:text-dark-text outline-none focus:border-[#1B7A6E] min-h-[80px]"
                />
                <button 
                  onClick={() => onResolve(alarm.id, resolveNote)}
                  disabled={!resolveNote.trim()}
                  className="w-full py-2 bg-white dark:bg-[#121212] border border-gray-300 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-light-text dark:text-dark-text disabled:opacity-50 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
                >
                  Resolve Alarm
                </button>
              </div>
            )}

            {alarm.status === 'Resolved' && (
              <button 
                onClick={() => onReopen(alarm.id)}
                className="w-full py-2 bg-white dark:bg-[#121212] border border-gray-300 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-light-text dark:text-dark-text rounded-sm text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
              >
                Reopen Alarm
              </button>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#262626]">
            <label className="block text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-2">Assigned To</label>
            <select 
              value={alarm.assignedTo || ''}
              onChange={(e) => onAssign(alarm.id, e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-sm text-light-text dark:text-dark-text outline-none focus:border-[#1B7A6E]"
            >
              <option value="">Unassigned</option>
              {staffList.map(staff => (
                <option key={staff.id} value={staff.id}>{staff.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Trigger Data */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-4">Trigger Data Snapshot</h3>
          <div className="bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-sm border border-gray-200 dark:border-[#262626] space-y-3">
            {Object.entries(alarm.triggerData).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center text-sm">
                <span className="text-light-text-secondary dark:text-[#9A9A9A]">{key}</span>
                <span className="font-medium text-light-text dark:text-dark-text">{value as string}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signal Snapshot */}
        {alarm.signalSnapshot && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Signal Context</h3>
              <button onClick={() => onViewDevice(alarm.deviceId)} className="text-xs text-[#1B7A6E] hover:underline flex items-center outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm">
                Full Data <ChevronRight size={12} className="ml-1" />
              </button>
            </div>
            <div className="h-40 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#262626] rounded-sm p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={alarm.signalSnapshot}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <Line type="monotone" dataKey="value" stroke={sevColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* History Audit */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] mb-4">Audit History</h3>
          <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-gray-200 dark:before:bg-[#333]">
            {alarm.history.map((entry: any, i: number) => (
              <div key={i} className="relative pl-6">
                <div className="absolute left-[3px] top-1.5 w-1.5 h-1.5 rounded-full bg-[#1B7A6E] ring-4 ring-white dark:ring-[#121212]" />
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
  alarms = MOCK_ALARM_DATA,
  escalationThresholdMinutes = 5,
  isLoading = false,
  onAcknowledge = () => {},
  onResolve = () => {},
  onReopen = () => {},
  onAssign = () => {},
  onViewDevice = () => {},
  staffList = MOCK_STAFF_LIST
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
    const timer = setInterval(() => setNow(Date.now()), 30000); // 30s updates
    return () => clearInterval(timer);
  }, []);

  const filteredAlarms = useMemo(() => {
    return alarms.filter(a => {
      if (activeTab !== 'All' && a.status !== activeTab) return false;
      if (filterSeverity !== 'All' && a.severity !== filterSeverity) return false;
      if (filterType !== 'All' && a.alarmType !== filterType) return false;
      if (searchQuery && !a.deviceId.toLowerCase().includes(searchQuery.toLowerCase()) && !a.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterDateStart && new Date(a.triggeredAt).getTime() < new Date(filterDateStart).getTime()) return false;
      if (filterDateEnd && new Date(a.triggeredAt).getTime() > new Date(filterDateEnd).getTime() + 86400000) return false; // Add 1 day to include end date
      return true;
    }).sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
  }, [alarms, activeTab, filterSeverity, filterType, searchQuery, filterDateStart, filterDateEnd]);

  const counts = useMemo(() => {
    return {
      Active: alarms.filter(a => a.status === 'Active').length,
      Acknowledged: alarms.filter(a => a.status === 'Acknowledged').length,
      Resolved: alarms.filter(a => a.status === 'Resolved').length,
      All: alarms.length
    };
  }, [alarms]);

  const selectedAlarm = alarms.find(a => a.id === selectedAlarmId);

  return (
    <div className="h-full flex flex-col bg-light-bg dark:bg-[#000000] text-light-text dark:text-dark-text relative overflow-hidden">
      
      {/* Header & Tabs */}
      <div className="flex-none px-6 py-4 pb-0 border-b border-gray-200 dark:border-[#262626] bg-light-card dark:bg-[#121212] sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight mb-1">Alarm Queue</h1>
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
            className="text-xs text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-dark-text flex items-center outline-none focus-visible:underline rounded-sm"
          >
            <X size={14} className="mr-1" /> Clear
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-light-bg dark:bg-[#000000]">
        
        {filteredAlarms.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            {activeTab === 'Active' && filterSeverity === 'All' && filterType === 'All' && !searchQuery ? (
              <>
                <div className="w-12 h-12 bg-[#1B7A6E]/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle size={24} className="text-[#1B7A6E]" />
                </div>
                <h3 className="text-sm font-bold text-light-text dark:text-dark-text mb-2">No active alarms right now.</h3>
                <p className="text-xs text-light-text-secondary dark:text-[#9A9A9A] max-w-sm mx-auto">
                  All devices are reporting normal status and signal quality.
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAlarms.map((alarm) => {
              const Icon = getSeverityStyles(alarm.severity).icon;
              const sevColor = getSeverityStyles(alarm.severity).color;
              const isEscalated = alarm.status === 'Active' && 
                (now - new Date(alarm.triggeredAt).getTime() > escalationThresholdMinutes * 60000);
              
              return (
                <div 
                  key={alarm.id}
                  onClick={() => setSelectedAlarmId(alarm.id)}
                  className={`bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-[#1B7A6E] dark:hover:border-[#1B7A6E] transition-colors group relative ${isEscalated ? 'border-l-4 border-l-[#C4453D] dark:border-l-[#C4453D]' : 'border-l-4 border-l-transparent'}`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="shrink-0 flex items-center justify-center w-8">
                      <Icon size={18} style={{ color: sevColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-light-text dark:text-dark-text truncate">{alarm.alarmType}</span>
                        <span className="text-xs text-light-text-secondary dark:text-[#9A9A9A]">•</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onViewDevice(alarm.deviceId); }}
                          className="text-xs font-medium text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] dark:hover:text-[#1B7A6E] transition-colors outline-none focus-visible:underline"
                        >
                          {alarm.deviceId}
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-light-text-secondary dark:text-[#9A9A9A]">
                        <span>{formatDate(alarm.triggeredAt)}</span>
                        <span className={isEscalated ? 'text-[#C4453D] font-bold animate-pulse' : ''}>
                          {formatElapsedTime(alarm.triggeredAt)} elapsed
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                    <div className="flex items-center gap-2">
                      {alarm.assignedTo && (
                        <div className="hidden sm:flex items-center text-xs text-light-text-secondary dark:text-[#9A9A9A]">
                          <User size={12} className="mr-1" /> {staffList.find(s => s.id === alarm.assignedTo)?.name || 'Assigned'}
                        </div>
                      )}
                      <span className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${
                        alarm.status === 'Active' ? 'bg-gray-100 dark:bg-[#1a1a1a] text-light-text dark:text-dark-text' : 
                        alarm.status === 'Acknowledged' ? 'bg-[#D99B3F]/10 text-[#D99B3F]' : 
                        'bg-[#1B7A6E]/10 text-[#1B7A6E]'
                      }`}>
                        {alarm.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {alarm.status === 'Active' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAcknowledge(alarm.id); }}
                          className="px-3 py-1.5 bg-[#1B7A6E]/10 hover:bg-[#1B7A6E]/20 text-[#1B7A6E] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
                        >
                          Ack
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
              className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40"
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
