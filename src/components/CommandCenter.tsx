import React, { useState } from 'react';
import { 
  ArrowLeft, Activity, User, Clock, Hash, CheckCircle, XCircle, 
  Terminal, DownloadCloud, RotateCcw, Calendar, Zap, Wrench, 
  Settings, Power, Trash2, Edit2, Check, X, ChevronDown, ChevronRight, AlertTriangle, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- MOCK DATA ---
const MOCK_DEVICE = {
  id: 'DEV-0198',
  serialNumber: 'SN-9345-8201',
  ownerName: 'Alice Smith',
  connectivityStatus: 'Online' as const,
  batteryLevel: 85,
  signalStrength: 4,
  lastSync: '2 min ago',
  firmwareVersion: 'v4.1.9',
  firmwareUpdateAvailable: true,
  currentSchedule: 'Every 4 hours',
  samplingRate: 250,
  onDeviceThresholds: {
    lossSensitivity: 5
  }
};

const MOCK_COMMAND_LOG = [
  { id: 'CMD-001', type: 'Firmware Update', sentBy: 'Admin', timestamp: '15 min ago', status: 'Success', detail: 'Updated to v4.2.0' },
  { id: 'CMD-002', type: 'Ping', sentBy: 'System', timestamp: '1 hour ago', status: 'Success', detail: 'Latency: 45ms' },
  { id: 'CMD-003', type: 'Restart Device', sentBy: 'Admin', timestamp: '2 days ago', status: 'Failed', detail: 'Device unresponsive' },
];

// --- TYPES ---
export interface CommandCenterProps {
  userRole?: string;
  device?: typeof MOCK_DEVICE;
  availableDevices?: {id: string}[];
  commandLog?: typeof MOCK_COMMAND_LOG;
  isLoading?: boolean;
  onBack?: () => void;
  onChangeDevice?: (deviceId: string) => void;
  onViewDataAnalysis?: (deviceId: string) => void;
  onUpdateOwnerName?: (deviceId: string, name: string) => void;
  onPushFirmwareUpdate?: (deviceId: string) => void;
  onRollbackFirmware?: (deviceId: string) => void;
  onUpdateSchedule?: (deviceId: string, schedule: string) => void;
  onRequestImmediateTransmission?: (deviceId: string) => void;
  onRunDiagnostic?: (deviceId: string) => void;
  onPingDevice?: (deviceId: string) => void;
  onUpdateConfiguration?: (deviceId: string, config: any) => void;
  onRestartDevice?: (deviceId: string) => void;
  onFactoryReset?: (deviceId: string) => void;
  onUnassignOwner?: (deviceId: string) => void;
  onRetireDevice?: (deviceId: string) => void;
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

// --- MAIN COMPONENT ---
export default function CommandCenter({
  userRole = 'Administrator',
  device = MOCK_DEVICE,
  availableDevices = [],
  commandLog = MOCK_COMMAND_LOG,
  isLoading = false,
  onBack = () => {},
  onChangeDevice = () => {},
  onViewDataAnalysis = () => {},
  onUpdateOwnerName = () => {},
  onPushFirmwareUpdate = () => {},
  onRollbackFirmware = () => {},
  onUpdateSchedule = () => {},
  onRequestImmediateTransmission = () => {},
  onRunDiagnostic = () => {},
  onPingDevice = () => {},
  onUpdateConfiguration = () => {},
  onRestartDevice = () => {},
  onFactoryReset = () => {},
  onUnassignOwner = () => {},
  onRetireDevice = () => {},
  onViewTelemetry = () => {}
}: CommandCenterProps) {

  // State
  const [activeAccordion, setActiveAccordion] = useState<string | null>('firmware');
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [ownerNameInput, setOwnerNameInput] = useState(device.ownerName);
  const [scheduleInput, setScheduleInput] = useState(device.currentSchedule);
  const [samplingRate, setSamplingRate] = useState(device.samplingRate);
  const [lossSensitivity, setLossSensitivity] = useState(device.onDeviceThresholds.lossSensitivity);
  
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');

  React.useEffect(() => {
    setOwnerNameInput(device.ownerName);
    setScheduleInput(device.currentSchedule);
    setSamplingRate(device.samplingRate);
    setLossSensitivity(device.onDeviceThresholds.lossSensitivity);
    setIsEditingOwner(false);
  }, [device.id]);
  
  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    actionType: 'primary' | 'danger';
    requireInputMatch?: string;
    onConfirm: () => void;
  } | null>(null);

  const [confirmInput, setConfirmInput] = useState('');
  
  const [diagnosticResults, setDiagnosticResults] = useState<{name: string, status: 'pass' | 'fail'}[] | null>(null);
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [isPingRunning, setIsPingRunning] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  // Local log state to show optimistic updates
  const [localLog, setLocalLog] = useState(commandLog);

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  const addLog = (type: string, status: string, detail: string) => {
    setLocalLog(prev => [{
      id: `CMD-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      type,
      sentBy: 'You',
      timestamp: 'Just now',
      status,
      detail
    }, ...prev]);
  };

  const executeCommandWithConfirm = (title: string, message: string, actionLabel: string, actionType: 'primary' | 'danger', action: () => void, requireInputMatch?: string) => {
    setConfirmInput('');
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      actionLabel,
      actionType,
      requireInputMatch,
      onConfirm: () => {
        setConfirmDialog(null);
        action();
      }
    });
  };

  const handleSaveOwner = () => {
    onUpdateOwnerName(device.id, ownerNameInput);
    setIsEditingOwner(false);
  };

  const runDiagnostic = () => {
    setIsDiagnosticRunning(true);
    setDiagnosticResults(null);
    onRunDiagnostic(device.id);
    addLog('Diagnostic', 'Pending', 'Running full suite...');
    
    setTimeout(() => {
      setIsDiagnosticRunning(false);
      setDiagnosticResults([
        { name: 'Battery Health', status: 'pass' },
        { name: 'ECG Lead Connectivity Ch1', status: 'pass' },
        { name: 'ECG Lead Connectivity Ch2', status: 'fail' },
        { name: 'Accelerometer Sensor', status: 'pass' },
        { name: 'Signal Strength', status: 'pass' },
        { name: 'Memory/Storage Status', status: 'pass' },
        { name: 'Firmware Integrity', status: 'pass' },
      ]);
      addLog('Diagnostic', 'Success', 'Diagnostic completed');
    }, 2000);
  };

  const runPing = () => {
    setIsPingRunning(true);
    setPingResult(null);
    onPingDevice(device.id);
    addLog('Ping', 'Pending', 'Waiting for response...');
    
    setTimeout(() => {
      setIsPingRunning(false);
      setPingResult('Latency: 32ms');
      addLog('Ping', 'Success', 'Latency: 32ms');
    }, 1000);
  };

  const AccordionHeader = ({ id, icon: Icon, title }: { id: string, icon: any, title: string }) => (
    <button 
      onClick={() => toggleAccordion(id)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-[#262626] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1B7A6E]"
    >
      <div className="flex items-center">
        <Icon size={18} className="text-light-text-secondary dark:text-[#9A9A9A] mr-3" />
        <span className="text-sm font-bold uppercase tracking-widest">{title}</span>
      </div>
      {activeAccordion === id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-light-bg dark:bg-[#000000] text-light-text dark:text-dark-text overflow-hidden relative">
      
      {/* Detail Header */}
      <div className="flex-none px-3 py-2 border-b border-gray-200 dark:border-[#262626] bg-light-card dark:bg-[#121212] sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="flex items-center text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] dark:hover:text-[#1B7A6E] transition-colors mb-1 outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm px-1 -ml-1 cursor-pointer w-max"
        >
          <ArrowLeft size={12} className="mr-1" /> Back
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="relative flex items-center">
                {availableDevices.length > 0 ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsDeviceMenuOpen(!isDeviceMenuOpen)}
                      className="text-lg font-bold tracking-tight bg-transparent outline-none focus:ring-2 focus:ring-[#1B7A6E] rounded-sm cursor-pointer flex items-center px-2 py-0.5 -ml-2 text-light-text dark:text-dark-text"
                    >
                      {device.id}
                      <ChevronDown size={16} className={`ml-1.5 text-light-text-secondary dark:text-[#9A9A9A] transform transition-transform ${isDeviceMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isDeviceMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDeviceMenuOpen(false)} />
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm shadow-xl z-50">
                          <div className="max-h-60 overflow-y-auto py-1">
                            {availableDevices.map(d => (
                              <button
                                key={d.id}
                                onClick={() => {
                                  onChangeDevice(d.id);
                                  setIsDeviceMenuOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-[#1a1a1a] ${d.id === device.id ? 'bg-[#1B7A6E]/10 text-[#1B7A6E] font-bold' : 'text-light-text dark:text-[#F2F2F2]'}`}
                              >
                                {d.id}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <h1 className="text-lg font-bold tracking-tight">{device.id}</h1>
                )}
              </div>
              <StatusBadge isOnline={device.connectivityStatus === 'Online'} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-light-text-secondary dark:text-[#9A9A9A]">
              <div className="flex items-center">
                <Hash size={12} className="mr-1" />
                {device.serialNumber}
              </div>
              <div className="flex items-center">
                <User size={12} className="mr-1" />
                {isEditingOwner ? (
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="text" 
                      value={ownerNameInput}
                      onChange={e => setOwnerNameInput(e.target.value)}
                      className="px-2 py-0.5 bg-white dark:bg-[#000000] border border-gray-300 dark:border-dark-border rounded-sm text-xs outline-none focus:ring-1 focus:ring-[#1B7A6E]"
                      autoFocus
                    />
                    <button onClick={handleSaveOwner} className="text-[#1B7A6E] hover:text-[#1B7A6E]"><Check size={12} /></button>
                    <button onClick={() => {setIsEditingOwner(false); setOwnerNameInput(device.ownerName);}} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <span className={device.ownerName ? '' : 'italic opacity-60'}>{device.ownerName || 'Unassigned'}</span>
                    <button onClick={() => setIsEditingOwner(true)} className="ml-1.5 text-gray-400 hover:text-[#1B7A6E] dark:text-[#666] dark:hover:text-[#1B7A6E] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm">
                      <Edit2 size={10} />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center">
                <BatteryIndicator level={device.batteryLevel} />
              </div>
              <div className="flex items-center">
                <Clock size={12} className="mr-1" />
                Last Sync: {device.lastSync}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:flex items-center">
              <Search size={12} className="absolute left-2 text-light-text-secondary dark:text-[#9A9A9A] pointer-events-none" />
              <input 
                type="text" 
                placeholder="Search device..." 
                value={deviceSearchQuery}
                onChange={(e) => setDeviceSearchQuery(e.target.value)}
                className="w-36 pl-6 pr-2 py-1 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333] rounded-sm text-[10px] outline-none focus:ring-1 focus:ring-[#1B7A6E]"
              />
              {deviceSearchQuery && (
                <div className="absolute top-full right-0 mt-1 w-full bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm shadow-xl z-50 max-h-48 overflow-y-auto py-1">
                  {availableDevices.filter(d => d.id.toLowerCase().includes(deviceSearchQuery.toLowerCase())).map(d => (
                    <button
                      key={d.id}
                      onClick={() => {
                        onChangeDevice(d.id);
                        setDeviceSearchQuery('');
                      }}
                      className="w-full text-left px-2 py-1.5 text-[10px] transition-colors hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-light-text dark:text-[#F2F2F2]"
                    >
                      {d.id}
                    </button>
                  ))}
                  {availableDevices.filter(d => d.id.toLowerCase().includes(deviceSearchQuery.toLowerCase())).length === 0 && (
                    <div className="px-2 py-1.5 text-[10px] text-light-text-secondary dark:text-[#9A9A9A]">
                      No devices found.
                    </div>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={() => onViewDataAnalysis(device.id)}
              className="px-2 py-1 bg-[#1B7A6E] hover:bg-[#1B7A6E]/90 text-white border border-[#1B7A6E] rounded-sm text-[9px] font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] cursor-pointer flex items-center"
            >
              <Activity size={12} className="sm:mr-1.5" /> <span className="hidden sm:inline">Data &amp; Analysis</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        
        {/* Telemetry Access */}
        <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm p-6 flex flex-col items-center justify-center text-center">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Command Panel */}
          <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a]">
              <h2 className="text-xs font-bold uppercase tracking-widest flex items-center">
                <Terminal size={16} className="mr-2 text-[#1B7A6E]" /> Command Interface
              </h2>
            </div>
            
            <div className="divide-y divide-gray-200 dark:divide-[#262626]">
              {/* Firmware */}
              <div>
                <AccordionHeader id="firmware" icon={DownloadCloud} title="Firmware Commands" />
                <AnimatePresence>
                  {activeAccordion === 'firmware' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="p-4 space-y-4 bg-white dark:bg-[#121212]">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-light-text-secondary dark:text-[#9A9A9A]">Current Version:</span>
                          <div className="flex items-center font-bold">
                            {device.firmwareVersion}
                            {device.firmwareUpdateAvailable && (
                              <span className="ml-3 px-2 py-0.5 bg-[#D99B3F]/10 text-[#D99B3F] border border-[#D99B3F]/20 rounded-sm text-[9px] uppercase tracking-widest">Update Available</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            disabled={!device.firmwareUpdateAvailable}
                            onClick={() => executeCommandWithConfirm(
                              'Push Firmware Update',
                              'Are you sure you want to push the latest firmware update? The device will restart during this process.',
                              'Push Update',
                              'primary',
                              () => {
                                onPushFirmwareUpdate(device.id);
                                addLog('Firmware Update', 'Pending', 'Pushing new firmware...');
                              }
                            )}
                            className="flex-1 py-2 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Push Update
                          </button>
                          <button 
                            onClick={() => executeCommandWithConfirm(
                              'Rollback Firmware',
                              'Are you sure you want to rollback to the previous firmware version?',
                              'Rollback',
                              'danger',
                              () => {
                                onRollbackFirmware(device.id);
                                addLog('Firmware Rollback', 'Pending', 'Reverting to previous version...');
                              }
                            )}
                            className="flex-1 py-2 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#C4453D] dark:hover:text-[#C4453D]"
                          >
                            Rollback Version
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Schedule */}
              <div>
                <AccordionHeader id="schedule" icon={Calendar} title="Data Transmission Schedule" />
                <AnimatePresence>
                  {activeAccordion === 'schedule' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="p-4 space-y-4 bg-white dark:bg-[#121212]">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider">
                            Transmission Frequency
                          </label>
                          <select 
                            value={scheduleInput}
                            onChange={(e) => setScheduleInput(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-[#000000] border border-gray-300 dark:border-dark-border rounded-sm text-sm outline-none focus:ring-2 focus:ring-[#1B7A6E]"
                          >
                            <option>Every 1 hour</option>
                            <option>Every 4 hours</option>
                            <option>Every 12 hours</option>
                            <option>Once daily</option>
                          </select>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => executeCommandWithConfirm(
                              'Save Schedule',
                              'Changing the schedule will affect how often data is received. Continue?',
                              'Save Schedule',
                              'primary',
                              () => {
                                onUpdateSchedule(device.id, scheduleInput);
                                addLog('Update Schedule', 'Pending', `Changed to: ${scheduleInput}`);
                              }
                            )}
                            className="flex-1 py-2 bg-[#1B7A6E]/10 hover:bg-[#1B7A6E]/20 text-[#1B7A6E] font-bold uppercase tracking-widest text-xs rounded-sm transition-colors"
                          >
                            Save Schedule
                          </button>
                          <button 
                            onClick={() => {
                              onRequestImmediateTransmission(device.id);
                              addLog('Immediate Transmission', 'Pending', 'Requesting data sync now...');
                            }}
                            className="flex-1 py-2 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors"
                          >
                            Sync Now
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Diagnostics */}
              <div>
                <AccordionHeader id="diagnostics" icon={Wrench} title="Diagnostics" />
                <AnimatePresence>
                  {activeAccordion === 'diagnostics' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="p-4 space-y-4 bg-white dark:bg-[#121212]">
                        <div className="flex gap-3">
                          <button 
                            onClick={runDiagnostic}
                            disabled={isDiagnosticRunning}
                            className="flex-1 py-2 bg-[#1B7A6E]/10 hover:bg-[#1B7A6E]/20 text-[#1B7A6E] font-bold uppercase tracking-widest text-xs rounded-sm transition-colors flex items-center justify-center disabled:opacity-50"
                          >
                            {isDiagnosticRunning ? (
                              <div className="w-4 h-4 border-2 border-[#1B7A6E]/30 border-t-[#1B7A6E] rounded-full animate-spin mr-2"></div>
                            ) : null}
                            Run Full Diagnostic
                          </button>
                          <button 
                            onClick={runPing}
                            disabled={isPingRunning}
                            className="flex-1 py-2 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center disabled:opacity-50"
                          >
                            {isPingRunning ? (
                              <div className="w-4 h-4 border-2 border-gray-500/30 border-t-gray-500 rounded-full animate-spin mr-2"></div>
                            ) : null}
                            Ping Device
                          </button>
                        </div>

                        {pingResult && (
                          <div className="p-3 bg-gray-50 dark:bg-[#0a0a0a] border border-[#1B7A6E]/30 rounded-sm flex items-center">
                            <CheckCircle size={14} className="text-[#1B7A6E] mr-2" />
                            <span className="text-xs font-mono">{pingResult}</span>
                          </div>
                        )}

                        {diagnosticResults && (
                          <div className="mt-4 border border-gray-200 dark:border-[#262626] rounded-sm overflow-hidden">
                            <div className="bg-gray-50 dark:bg-[#0a0a0a] p-2 border-b border-gray-200 dark:border-[#262626]">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">Results Checklist</span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-[#1a1a1a]">
                              {diagnosticResults.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-2 text-sm">
                                  <span className="text-xs text-light-text dark:text-[#F2F2F2]">{item.name}</span>
                                  {item.status === 'pass' ? (
                                    <CheckCircle size={14} className="text-[#1B7A6E]" />
                                  ) : (
                                    <XCircle size={14} className="text-[#C4453D]" />
                                  )}
                                </div>
                              ))}
                            </div>
                            {userRole === 'IT / Device Support' || userRole === 'Administrator' ? (
                              <button className="w-full py-2 bg-gray-100 dark:bg-[#1a1a1a] text-[10px] font-bold uppercase tracking-widest hover:text-[#1B7A6E] transition-colors border-t border-gray-200 dark:border-[#262626]">
                                View Technical Details
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Config */}
              <div>
                <AccordionHeader id="config" icon={Settings} title="Configuration Commands" />
                <AnimatePresence>
                  {activeAccordion === 'config' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="p-4 space-y-4 bg-white dark:bg-[#121212]">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider">
                              Sampling Rate (Hz)
                            </label>
                            <select 
                              value={samplingRate}
                              onChange={(e) => setSamplingRate(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#000000] border border-gray-300 dark:border-dark-border rounded-sm text-sm outline-none focus:ring-2 focus:ring-[#1B7A6E]"
                            >
                              <option value={125}>125 Hz</option>
                              <option value={250}>250 Hz</option>
                              <option value={500}>500 Hz</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider">
                              Loss Sensitivity
                            </label>
                            <input 
                              type="number" 
                              min="1" max="10"
                              value={lossSensitivity}
                              onChange={(e) => setLossSensitivity(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#000000] border border-gray-300 dark:border-dark-border rounded-sm text-sm outline-none focus:ring-2 focus:ring-[#1B7A6E]"
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => executeCommandWithConfirm(
                            'Save Configuration',
                            'Are you sure you want to push these new configuration values to the device?',
                            'Save Config',
                            'primary',
                            () => {
                              onUpdateConfiguration(device.id, { samplingRate, lossSensitivity });
                              addLog('Update Config', 'Pending', 'Pushing configuration...');
                            }
                          )}
                          className="w-full py-2 bg-[#1B7A6E]/10 hover:bg-[#1B7A6E]/20 text-[#1B7A6E] font-bold uppercase tracking-widest text-xs rounded-sm transition-colors"
                        >
                          Save Configuration
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Lifecycle */}
              <div>
                <AccordionHeader id="lifecycle" icon={Power} title="Device Lifecycle Commands" />
                <AnimatePresence>
                  {activeAccordion === 'lifecycle' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="p-4 space-y-3 bg-white dark:bg-[#121212]">
                        <button 
                          onClick={() => executeCommandWithConfirm(
                            'Restart Device',
                            'Are you sure you want to restart this device? It will briefly go offline.',
                            'Restart',
                            'primary',
                            () => {
                              onRestartDevice(device.id);
                              addLog('Restart', 'Pending', 'Sending restart command...');
                            }
                          )}
                          className="w-full flex items-center justify-between p-3 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors text-light-text dark:text-[#F2F2F2]"
                        >
                          <span>Restart Device</span>
                          <RotateCcw size={14} className="text-[#9A9A9A]" />
                        </button>

                        <button 
                          onClick={() => executeCommandWithConfirm(
                            'Unassign Owner',
                            'Are you sure you want to unassign this device? The owner name will be cleared.',
                            'Unassign',
                            'primary',
                            () => {
                              onUnassignOwner(device.id);
                              addLog('Unassign Owner', 'Success', 'Owner cleared');
                            }
                          )}
                          className="w-full flex items-center justify-between p-3 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors text-light-text dark:text-[#F2F2F2]"
                        >
                          <span>Unassign Owner</span>
                          <User size={14} className="text-[#9A9A9A]" />
                        </button>

                        <button 
                          onClick={() => executeCommandWithConfirm(
                            'Factory Reset',
                            'This will erase all data and reset the device to factory defaults.',
                            'Factory Reset',
                            'danger',
                            () => {
                              onFactoryReset(device.id);
                              addLog('Factory Reset', 'Pending', 'Initiating factory reset...');
                            },
                            device.id
                          )}
                          className="w-full flex items-center justify-between p-3 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-[#C4453D]/10 border border-[#C4453D]/30 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors text-[#C4453D]"
                        >
                          <span>Factory Reset</span>
                          <AlertTriangle size={14} />
                        </button>

                        <button 
                          onClick={() => executeCommandWithConfirm(
                            'Retire Device',
                            'Are you sure you want to permanently retire this device? It will be removed from active monitoring.',
                            'Retire Device',
                            'danger',
                            () => {
                              onRetireDevice(device.id);
                              addLog('Retire Device', 'Success', 'Device marked as retired');
                            }
                          )}
                          className="w-full flex items-center justify-between p-3 border border-[#C4453D] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors text-[#C4453D] hover:bg-[#C4453D] hover:text-white group"
                        >
                          <span>Retire Device</span>
                          <Trash2 size={14} className="group-hover:text-white text-[#C4453D]" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Command Log */}
          <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm overflow-hidden flex flex-col h-full min-h-[400px]">
            <div className="p-4 border-b border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest">Command Log</h2>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-[#262626] text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Command Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sent By</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1a1a1a] bg-white dark:bg-[#121212]">
                  {localLog.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-light-text dark:text-[#F2F2F2] text-xs">{log.type}</div>
                        <div className="text-[10px] text-light-text-secondary dark:text-[#9A9A9A] mt-0.5">{log.detail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border ${
                          log.status === 'Success' ? 'bg-[#1B7A6E]/10 text-[#1B7A6E] border-[#1B7A6E]/20' :
                          log.status === 'Failed' ? 'bg-[#C4453D]/10 text-[#C4453D] border-[#C4453D]/20' :
                          'bg-[#7C8A94]/10 text-[#7C8A94] border-[#7C8A94]/20'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-light-text-secondary dark:text-[#9A9A9A]">{log.sentBy}</td>
                      <td className="px-4 py-3 text-xs text-light-text-secondary dark:text-[#9A9A9A]">{log.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-3 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] text-center">
              <span className="text-[10px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-widest">Showing last {localLog.length} commands</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Overlay */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm w-full max-w-sm shadow-xl flex flex-col"
            >
              <div className="p-6">
                <h3 className="text-lg font-bold text-light-text dark:text-[#F2F2F2] mb-2">{confirmDialog.title}</h3>
                <p className="text-sm text-light-text-secondary dark:text-[#9A9A9A] leading-relaxed mb-6">
                  {confirmDialog.message}
                </p>
                
                {confirmDialog.requireInputMatch && (
                  <div className="mb-6">
                    <label className="block text-[11px] font-bold text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-wider mb-1.5">
                      Type "{confirmDialog.requireInputMatch}" to confirm
                    </label>
                    <input 
                      type="text" 
                      value={confirmInput}
                      onChange={e => setConfirmInput(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#000000] border border-gray-300 dark:border-dark-border rounded-sm text-sm outline-none focus:ring-2 focus:ring-[#C4453D]"
                      placeholder={confirmDialog.requireInputMatch}
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 py-2.5 bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#262626] border border-gray-300 dark:border-[#333] rounded-sm text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={confirmDialog.requireInputMatch ? confirmInput !== confirmDialog.requireInputMatch : false}
                    onClick={confirmDialog.onConfirm}
                    className={`flex-1 py-2.5 font-bold uppercase tracking-widest text-xs rounded-sm transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                      confirmDialog.actionType === 'danger' 
                        ? 'bg-[#C4453D] hover:bg-[#C4453D]/90' 
                        : 'bg-[#1B7A6E] hover:bg-[#1B7A6E]/90'
                    }`}
                  >
                    {confirmDialog.actionLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
