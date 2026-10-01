import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, Activity, User, Clock, Hash, CheckCircle, XCircle, 
  Terminal, DownloadCloud, RotateCcw, Calendar, Zap, Wrench, 
  Settings, Power, Trash2, Edit2, Check, X, ChevronRight, 
  AlertTriangle, Search, Filter, Wifi, Battery, Send, RefreshCw, 
  Radio, ShieldAlert, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- MOCK FALLBACK DATA ---
const MOCK_DEVICE = {
  id: 'DEV-0198',
  serialNumber: 'SN-9345-8201',
  ownerName: 'Alice Smith',
  connectivityStatus: 'Online' as const,
  batteryLevel: 85,
  batteryVoltageMv: 3980,
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

export interface CommandCenterProps {
  userRole?: string;
  device?: any;
  availableDevices?: any[];
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

type CommandCategory = 'diagnostics' | 'transmission' | 'config' | 'firmware' | 'lifecycle';

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

  // Current active target device
  const currentDevice = device || MOCK_DEVICE;
  const deviceList = availableDevices.length > 0 ? availableDevices : [currentDevice];

  // Device search and filter state
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Command selection category
  const [selectedCategory, setSelectedCategory] = useState<CommandCategory>('diagnostics');

  // Config parameters state
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [ownerNameInput, setOwnerNameInput] = useState(currentDevice.ownerName || '');
  const [scheduleInput, setScheduleInput] = useState(currentDevice.currentSchedule || 'Every 4 hours');
  const [samplingRate, setSamplingRate] = useState(currentDevice.samplingRate || 250);
  const [lossSensitivity, setLossSensitivity] = useState(currentDevice.onDeviceThresholds?.lossSensitivity || 5);
  
  // Execution & feedback states
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastDispatchedAction, setLastDispatchedAction] = useState<string | null>(null);
  const [isPingRunning, setIsPingRunning] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<{name: string, status: 'pass' | 'fail'}[] | null>(null);

  // Manual terminal prompt & logs
  const [manualCommandInput, setManualCommandInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    `[SYS INIT] TIRTATRACE Command Protocol v4.2 bound to port 8443`,
    `[READY] Target node selected: ${currentDevice.id} (Status: ${currentDevice.connectivityStatus || 'Online'})`,
    `[INFO] Awaiting dispatch instruction...`
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Local log state
  const [localLog, setLocalLog] = useState(commandLog);

  // Confirmation modal dialog state
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

  // Sync inputs when selected device changes
  useEffect(() => {
    setOwnerNameInput(currentDevice.ownerName || '');
    setScheduleInput(currentDevice.currentSchedule || 'Every 4 hours');
    setSamplingRate(currentDevice.samplingRate || 250);
    setLossSensitivity(currentDevice.onDeviceThresholds?.lossSensitivity || 5);
    setIsEditingOwner(false);
    setPingResult(null);
    setDiagnosticResults(null);
    addTerminalLog(`[NODE SWITCH] Active target set to ${currentDevice.id} (${currentDevice.serialNumber || 'SN-N/A'})`);
  }, [currentDevice.id]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  const addTerminalLog = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    setTerminalLogs(prev => [...prev.slice(-40), `[${timestamp}] ${msg}`]);
  };

  const addLog = (type: string, status: string, detail: string) => {
    setLocalLog(prev => [{
      id: `CMD-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      type,
      sentBy: userRole === 'Administrator' ? 'Admin' : 'Operator',
      timestamp: 'Just now',
      status,
      detail
    }, ...prev]);
  };

  // Filtered devices list
  const filteredDevices = useMemo(() => {
    return deviceList.filter(d => {
      const q = deviceSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        d.id.toLowerCase().includes(q) || 
        (d.serialNumber && d.serialNumber.toLowerCase().includes(q)) ||
        (d.ownerName && d.ownerName.toLowerCase().includes(q));
      
      const isOnline = (d.connectivityStatus || '').toLowerCase() === 'online';
      const matchesStatus = 
        deviceFilter === 'all' || 
        (deviceFilter === 'online' && isOnline) ||
        (deviceFilter === 'offline' && !isOnline);

      return matchesSearch && matchesStatus;
    });
  }, [deviceList, deviceSearch, deviceFilter]);

  const handleDeviceSelect = (id: string) => {
    onChangeDevice(id);
  };

  const executeWithConfirm = (
    title: string, 
    message: string, 
    actionLabel: string, 
    actionType: 'primary' | 'danger', 
    action: () => void, 
    requireInputMatch?: string
  ) => {
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
    onUpdateOwnerName(currentDevice.id, ownerNameInput);
    setIsEditingOwner(false);
    addLog('Update Owner', 'Success', `Assigned to: ${ownerNameInput}`);
    addTerminalLog(`[OWNER] Updated metadata owner name to: "${ownerNameInput}"`);
  };

  // Command Execution Handlers
  const handlePing = () => {
    setIsPingRunning(true);
    setPingResult(null);
    setLastDispatchedAction('Ping Device');
    addTerminalLog(`[TX] AT+CSQ -> ${currentDevice.id} (Querying signal RSSI/latency)`);
    onPingDevice(currentDevice.id);
    addLog('Ping', 'Pending', 'Waiting for latency response...');

    setTimeout(() => {
      setIsPingRunning(false);
      const latency = Math.floor(Math.random() * 25) + 22;
      setPingResult(`Echo reply from ${currentDevice.id}: Latency ${latency}ms | RSSI: ${currentDevice.signalStrength || 4}/4`);
      addTerminalLog(`[RX] +CSQ: 28,99 (RTT: ${latency}ms, ACK received from modem)`);
      addLog('Ping', 'Success', `Latency: ${latency}ms`);
      setLastDispatchedAction(null);
    }, 1200);
  };

  const handleDiagnostic = () => {
    setIsDiagnosticRunning(true);
    setDiagnosticResults(null);
    setLastDispatchedAction('Full Diagnostic Suite');
    addTerminalLog(`[TX] AT+DIAG_RUN -> ${currentDevice.id} (Initiating multi-sensor self-test)`);
    onRunDiagnostic(currentDevice.id);
    addLog('Diagnostic', 'Pending', 'Executing self-test suite...');

    setTimeout(() => {
      setIsDiagnosticRunning(false);
      setDiagnosticResults([
        { name: 'ECG Continuous Channel 1 (Lead I)', status: 'pass' },
        { name: 'ECG Continuous Channel 2 (Lead II)', status: 'pass' },
        { name: 'LSM6DSO 6-Axis IMU Sensor', status: 'pass' },
        { name: 'SIM7080G LTE-M / NB-IoT Modem', status: 'pass' },
        { name: 'MicroSD Flash File System', status: 'pass' },
        { name: 'Internal Voltage Rail (3.3V LDO)', status: 'pass' },
        { name: 'Firmware Checksum Verification', status: 'pass' },
      ]);
      addTerminalLog(`[RX] +DIAG: PASS=7 FAIL=0 (All primary telemetry channels healthy)`);
      addLog('Diagnostic', 'Success', 'Diagnostic completed: 7/7 PASSED');
      setLastDispatchedAction(null);
    }, 2200);
  };

  const handleImmediateSync = () => {
    setIsExecuting(true);
    setLastDispatchedAction('Sync Now');
    addTerminalLog(`[TX] AT+TXSYNC=FORCE -> ${currentDevice.id} (Flush buffer to Ingest API)`);
    onRequestImmediateTransmission(currentDevice.id);
    addLog('Immediate Transmission', 'Pending', 'Triggering buffer upload...');

    setTimeout(() => {
      setIsExecuting(false);
      addTerminalLog(`[RX] +TXSYNC: OK (Device confirmed upload of pending ECG/IMU packets)`);
      addLog('Immediate Transmission', 'Success', 'Buffer uploaded and confirmed');
      setLastDispatchedAction(null);
    }, 1500);
  };

  const handleSaveSchedule = () => {
    executeWithConfirm(
      'Update Transmission Schedule',
      `Configure upload cadence for device ${currentDevice.id} to "${scheduleInput}"?`,
      'Apply Schedule',
      'primary',
      () => {
        setIsExecuting(true);
        addTerminalLog(`[TX] AT+SCHED="${scheduleInput}" -> ${currentDevice.id}`);
        onUpdateSchedule(currentDevice.id, scheduleInput);
        addLog('Update Schedule', 'Pending', `Changed schedule to ${scheduleInput}`);
        setTimeout(() => {
          setIsExecuting(false);
          addTerminalLog(`[RX] +SCHED: OK (Frequency set to: ${scheduleInput})`);
          addLog('Update Schedule', 'Success', `Active: ${scheduleInput}`);
        }, 1200);
      }
    );
  };

  const handleSaveConfig = () => {
    executeWithConfirm(
      'Push Sensor Configuration',
      `Transmit updated parameters (Sampling Rate: ${samplingRate}Hz, Loss Sensitivity: ${lossSensitivity}) to ${currentDevice.id}?`,
      'Push Config',
      'primary',
      () => {
        setIsExecuting(true);
        addTerminalLog(`[TX] AT+CONFIG=SR:${samplingRate},LS:${lossSensitivity} -> ${currentDevice.id}`);
        onUpdateConfiguration(currentDevice.id, { samplingRate, lossSensitivity });
        addLog('Update Config', 'Pending', `SR: ${samplingRate}Hz, LS: ${lossSensitivity}`);
        setTimeout(() => {
          setIsExecuting(false);
          addTerminalLog(`[RX] +CONFIG: OK (Sampling rate locked at ${samplingRate}Hz)`);
          addLog('Update Config', 'Success', 'Configuration saved on device flash');
        }, 1200);
      }
    );
  };

  const handleFirmwareUpdate = () => {
    executeWithConfirm(
      'Push Firmware OTA Update',
      `Flash latest target firmware image to ${currentDevice.id}? The node will enter bootloader mode and restart.`,
      'Deploy Firmware',
      'primary',
      () => {
        setIsExecuting(true);
        addTerminalLog(`[OTA] AT+FW_PUSH=v4.2.1 -> ${currentDevice.id} (Initiating FOTA payload chunking)`);
        onPushFirmwareUpdate(currentDevice.id);
        addLog('Firmware Update', 'Pending', 'Pushing binary v4.2.1 OTA...');
        setTimeout(() => {
          setIsExecuting(false);
          addTerminalLog(`[OTA] Transfer complete (100%). Device rebooting with updated image.`);
          addLog('Firmware Update', 'Success', 'Updated firmware to v4.2.1');
        }, 2500);
      }
    );
  };

  const handleFirmwareRollback = () => {
    executeWithConfirm(
      'Rollback Firmware Image',
      `Revert ${currentDevice.id} back to golden fallback image?`,
      'Rollback',
      'danger',
      () => {
        setIsExecuting(true);
        addTerminalLog(`[OTA] AT+FW_ROLLBACK -> ${currentDevice.id} (Switching boot partition)`);
        onRollbackFirmware(currentDevice.id);
        addLog('Firmware Rollback', 'Pending', 'Reverting to golden image...');
        setTimeout(() => {
          setIsExecuting(false);
          addTerminalLog(`[OTA] Reverted to safe partition v4.1.8`);
          addLog('Firmware Rollback', 'Success', 'Firmware rolled back to v4.1.8');
        }, 2000);
      }
    );
  };

  const handleRestart = () => {
    executeWithConfirm(
      'Reboot Device',
      `Send reboot instruction to ${currentDevice.id}? Telemetry will pause for ~15 seconds while modem re-negotiates cellular connection.`,
      'Reboot',
      'primary',
      () => {
        setIsExecuting(true);
        addTerminalLog(`[POWER] AT+CFUN=1,1 -> ${currentDevice.id} (Hardware reset triggered)`);
        onRestartDevice(currentDevice.id);
        addLog('Restart', 'Pending', 'Reset command sent');
        setTimeout(() => {
          setIsExecuting(false);
          addTerminalLog(`[POWER] Device ${currentDevice.id} reconnected. Handshake ACK received.`);
          addLog('Restart', 'Success', 'Device rebooted successfully');
        }, 2000);
      }
    );
  };

  const handleUnassignOwner = () => {
    executeWithConfirm(
      'Unassign Owner',
      `Remove owner assignment for ${currentDevice.id}? The unit will become available in unassigned inventory.`,
      'Unassign',
      'primary',
      () => {
        onUnassignOwner(currentDevice.id);
        addLog('Unassign Owner', 'Success', 'Owner cleared');
        addTerminalLog(`[INVENTORY] Unassigned patient/owner from ${currentDevice.id}`);
      }
    );
  };

  const handleFactoryReset = () => {
    executeWithConfirm(
      'Factory Reset Device',
      `This will completely wipe configuration, local flash buffer, and encryption tokens on ${currentDevice.id}. This action CANNOT be undone.`,
      'Execute Factory Reset',
      'danger',
      () => {
        setIsExecuting(true);
        addTerminalLog(`[RESET] AT+FACTORY_RST -> ${currentDevice.id} (Wiping storage and registers)`);
        onFactoryReset(currentDevice.id);
        addLog('Factory Reset', 'Pending', 'Wiping device flash...');
        setTimeout(() => {
          setIsExecuting(false);
          addTerminalLog(`[RESET] Device memory cleared. Re-enrolling with factory defaults.`);
          addLog('Factory Reset', 'Success', 'Device factory reset complete');
        }, 2500);
      },
      currentDevice.id
    );
  };

  const handleRetireDevice = () => {
    executeWithConfirm(
      'Retire Device from Fleet',
      `Permanently decommission ${currentDevice.id}? The device will be deactivated and removed from active telemetry alerts.`,
      'Decommission Unit',
      'danger',
      () => {
        onRetireDevice(currentDevice.id);
        addLog('Retire Device', 'Success', 'Decommissioned from fleet');
        addTerminalLog(`[LIFECYCLE] Node ${currentDevice.id} decommissioned and marked RETIRED.`);
      }
    );
  };

  const handleManualCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCommandInput.trim()) return;
    const cmd = manualCommandInput.trim().toUpperCase();
    addTerminalLog(`[USER TX] ${cmd} -> ${currentDevice.id}`);
    setManualCommandInput('');

    setTimeout(() => {
      if (cmd.startsWith('AT+CSQ')) {
        addTerminalLog(`[RX] +CSQ: 28,99 (Signal: Excellent, RSSI: -67 dBm)`);
      } else if (cmd.startsWith('AT+CBC') || cmd.includes('BATT')) {
        const v = currentDevice.batteryVoltageMv || 3980;
        addTerminalLog(`[RX] +CBC: 0,${currentDevice.batteryLevel || 85},${v}mV (Battery healthy)`);
      } else if (cmd.startsWith('AT+INFO') || cmd.startsWith('ATI')) {
        addTerminalLog(`[RX] TIRTATRACE Rev1.0 / SIM7080G / FW: ${currentDevice.firmwareVersion || 'v4.1.9'}`);
      } else if (cmd.startsWith('AT+SYNC')) {
        addTerminalLog(`[RX] +SYNC: OK (Transmitted buffer: 120 samples)`);
      } else if (cmd === 'AT') {
        addTerminalLog(`[RX] OK`);
      } else {
        addTerminalLog(`[RX] OK (Command dispatched to ${currentDevice.id})`);
      }
    }, 600);
  };

  const isCurrentOnline = (currentDevice.connectivityStatus || '').toLowerCase() === 'online';

  return (
    <div className="h-full flex flex-col bg-[#050505] text-[#F2F2F2] overflow-hidden select-none">
      
      {/* Top Navigation & Operational Status Bar */}
      <header className="flex-none px-4 py-3 bg-[#0d0d0d] border-b border-[#222] flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#181818] hover:bg-[#252525] border border-[#333] hover:border-[#444] rounded text-xs font-semibold text-[#bbb] hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Fleet</span>
          </button>

          <div className="h-4 w-px bg-[#262626]" />

          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#1B7A6E] animate-pulse" />
            <h1 className="text-sm font-bold tracking-wider uppercase text-white flex items-center gap-2">
              <span>TIRTATRACE</span>
              <span className="text-xs font-medium text-[#1B7A6E] bg-[#1B7A6E]/10 border border-[#1B7A6E]/30 px-2 py-0.5 rounded">
                Unified Command Center
              </span>
            </h1>
          </div>
        </div>

        {/* Global Summary Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden md:flex items-center gap-2 text-[#888]">
            <span>Fleet Scope:</span>
            <span className="font-mono font-semibold text-white">{deviceList.length} Units</span>
            <span className="text-[#1B7A6E] font-semibold">({deviceList.filter(d => (d.connectivityStatus || '').toLowerCase() === 'online').length} Online)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewTelemetry(currentDevice.id)}
              className="px-3 py-1.5 bg-[#181818] hover:bg-[#222] text-[#ccc] hover:text-white border border-[#333] rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Radio size={13} className="text-[#3ADB8F]" />
              <span>Live Telemetry</span>
            </button>
            <button
              onClick={() => onViewDataAnalysis(currentDevice.id)}
              className="px-3 py-1.5 bg-[#1B7A6E] hover:bg-[#156359] text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-[#1B7A6E]/20 cursor-pointer"
            >
              <Activity size={13} />
              <span>Data &amp; Analysis</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dual-Section Interactive Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: DEVICE SELECTION PART                             */}
        {/* ============================================================== */}
        <aside className="w-full lg:w-96 flex-none bg-[#0a0a0a] border-r border-[#222] flex flex-col overflow-hidden">
          
          {/* Device Selection Header & Search Filter */}
          <div className="p-3 border-b border-[#222] bg-[#0f0f0f] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={15} className="text-[#1B7A6E]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Select Target Device</span>
              </div>
              <span className="text-[10px] font-mono text-[#888] bg-[#1a1a1a] px-2 py-0.5 rounded border border-[#2a2a2a]">
                {filteredDevices.length} matched
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#666]" />
              <input
                type="text"
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                placeholder="Search ID, SN, or Patient..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#161616] border border-[#2e2e2e] focus:border-[#1B7A6E] rounded text-xs text-white placeholder-[#666] outline-none transition-colors"
              />
              {deviceSearch && (
                <button 
                  onClick={() => setDeviceSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#888] hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-[#141414] p-1 rounded border border-[#222]">
              {(['all', 'online', 'offline'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDeviceFilter(tab)}
                  className={`py-1 text-[11px] font-medium capitalize rounded transition-all cursor-pointer ${
                    deviceFilter === tab 
                      ? 'bg-[#1B7A6E] text-white font-bold shadow-sm' 
                      : 'text-[#888] hover:text-white hover:bg-[#1f1f1f]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Device Cards List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 divide-y divide-transparent">
            {filteredDevices.length === 0 ? (
              <div className="p-8 text-center text-[#666] text-xs">
                <Cpu size={24} className="mx-auto mb-2 opacity-40" />
                <p>No devices matching filter.</p>
              </div>
            ) : (
              filteredDevices.map((d) => {
                const isSelected = d.id === currentDevice.id;
                const isOnline = (d.connectivityStatus || '').toLowerCase() === 'online';
                const battMv = d.batteryVoltageMv || (d.batteryLevel ? Math.round(3300 + (d.batteryLevel / 100) * 900) : 3980);

                return (
                  <div
                    key={d.id}
                    onClick={() => handleDeviceSelect(d.id)}
                    className={`group relative p-3 rounded-md transition-all cursor-pointer border text-left ${
                      isSelected
                        ? 'bg-[#142320] border-[#1B7A6E] shadow-[0_0_15px_rgba(27,122,110,0.25)]'
                        : 'bg-[#111111] hover:bg-[#171717] border-[#222] hover:border-[#333]'
                    }`}
                  >
                    {/* Active Target Indicator Ribbon */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#1B7A6E] text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">
                        <Check size={10} /> Active Target
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {/* Device ID */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full flex-none ${
                            isOnline ? 'bg-[#3ADB8F] shadow-[0_0_8px_#3ADB8F]' : 'bg-[#C4453D]'
                          }`} />
                          <h3 className={`font-mono text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#ddd] group-hover:text-white'}`}>
                            {d.id}
                          </h3>
                        </div>

                        {/* Owner / Patient */}
                        <div className="flex items-center gap-1 text-[11px] text-[#999] mb-2 truncate">
                          <User size={11} className="flex-none text-[#666]" />
                          <span className="truncate">{d.ownerName || 'Unassigned Patient'}</span>
                        </div>

                        {/* Quick Telemetry Chips */}
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#888]">
                          <span className="flex items-center gap-1 bg-[#181818] px-1.5 py-0.5 rounded border border-[#282828]">
                            <Battery size={10} className={d.batteryLevel < 20 ? 'text-[#C4453D]' : 'text-[#3ADB8F]'} />
                            <span>{d.batteryLevel || 85}% ({battMv}mV)</span>
                          </span>

                          <span className="flex items-center gap-1 bg-[#181818] px-1.5 py-0.5 rounded border border-[#282828]">
                            <Wifi size={10} className="text-[#1B7A6E]" />
                            <span>{d.signalStrength || 4}/4</span>
                          </span>

                          <span className="truncate text-[#777]">
                            {d.lastSync || '2m ago'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Fleet Quick-Select Footer */}
          <div className="p-3 border-t border-[#222] bg-[#0c0c0c] text-[11px] text-[#777] flex items-center justify-between">
            <span>Selecting a device loads its command registers</span>
            <span className="font-mono text-[#1B7A6E] font-semibold">Ready</span>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: COMMAND SELECTION & DISPATCH PART                */}
        {/* ============================================================== */}
        <main className="flex-1 flex flex-col bg-[#050505] overflow-y-auto">
          
          {/* Active Device Command Header Banner */}
          <div className="p-4 md:p-6 bg-gradient-to-r from-[#0d1614] via-[#0f0f0f] to-[#121212] border-b border-[#222] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#1B7A6E] bg-[#1B7A6E]/15 border border-[#1B7A6E]/30 px-2 py-0.5 rounded">
                  Target Device
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  isCurrentOnline 
                    ? 'bg-[#1B7A6E]/15 text-[#3ADB8F] border-[#1B7A6E]/30' 
                    : 'bg-[#C4453D]/15 text-[#C4453D] border-[#C4453D]/30'
                }`}>
                  {isCurrentOnline ? '● Connected' : '○ Offline'}
                </span>
              </div>

              <h2 className="text-lg md:text-xl font-mono font-bold text-white tracking-tight break-all">
                {currentDevice.id}
              </h2>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[#888] mt-2">
                <span className="flex items-center gap-1">
                  <Hash size={12} className="text-[#666]" />
                  <span>SN: <strong className="text-[#bbb] font-mono">{currentDevice.serialNumber || 'SN-9345-8201'}</strong></span>
                </span>

                <span className="text-[#333]">•</span>

                {/* Inline Owner Editor */}
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-[#666]" />
                  {isEditingOwner ? (
                    <div className="flex items-center gap-1">
                      <input 
                        type="text" 
                        value={ownerNameInput}
                        onChange={e => setOwnerNameInput(e.target.value)}
                        className="px-2 py-0.5 bg-[#000] border border-[#1B7A6E] rounded text-xs text-white outline-none"
                        autoFocus
                      />
                      <button onClick={handleSaveOwner} className="text-[#3ADB8F] hover:text-white p-0.5">
                        <Check size={14} />
                      </button>
                      <button onClick={() => { setIsEditingOwner(false); setOwnerNameInput(currentDevice.ownerName); }} className="text-[#999] hover:text-white p-0.5">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span>Owner: <strong className="text-[#ccc]">{currentDevice.ownerName || 'Unassigned'}</strong></span>
                      <button onClick={() => setIsEditingOwner(true)} className="text-[#666] hover:text-[#1B7A6E] transition-colors p-0.5" title="Edit owner">
                        <Edit2 size={11} />
                      </button>
                    </span>
                  )}
                </div>

                <span className="text-[#333]">•</span>

                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-[#666]" />
                  <span>Last Sync: <strong className="text-[#bbb]">{currentDevice.lastSync || '2 min ago'}</strong></span>
                </span>
                
                <span className="text-[#333]">•</span>

                <span className="font-mono text-[#bbb]">
                  FW: <strong className="text-[#1B7A6E]">{currentDevice.firmwareVersion || 'v4.1.9'}</strong>
                </span>
              </div>
            </div>

            {/* Quick Diagnostic Pill Buttons */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={handlePing}
                disabled={isPingRunning || isExecuting}
                className="px-3 py-2 bg-[#161616] hover:bg-[#202020] border border-[#333] hover:border-[#1B7A6E] rounded text-xs font-semibold text-white transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isPingRunning ? <RefreshCw size={13} className="animate-spin text-[#1B7A6E]" /> : <Radio size={13} className="text-[#3ADB8F]" />}
                <span>Ping Node</span>
              </button>

              <button
                onClick={handleImmediateSync}
                disabled={isExecuting}
                className="px-3 py-2 bg-[#1B7A6E] hover:bg-[#156359] text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-[#1B7A6E]/20 disabled:opacity-50 cursor-pointer"
              >
                <Zap size={13} />
                <span>Force Sync Now</span>
              </button>
            </div>
          </div>

          {/* Command Category Selection Strip */}
          <div className="px-4 md:px-6 pt-4 border-b border-[#222] bg-[#080808] flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'diagnostics', label: 'Diagnostics & Health', icon: Wrench, color: '#1B7A6E' },
              { id: 'transmission', label: 'Scheduling & Ingest', icon: Calendar, color: '#3ADB8F' },
              { id: 'config', label: 'Sensor Configuration', icon: Settings, color: '#4A90E2' },
              { id: 'firmware', label: 'Firmware & OTA', icon: DownloadCloud, color: '#D99B3F' },
              { id: 'lifecycle', label: 'Lifecycle & Failsafe', icon: ShieldAlert, color: '#C4453D' },
            ].map(cat => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as CommandCategory)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-md transition-all whitespace-nowrap border-b-2 cursor-pointer ${
                    isActive 
                      ? 'bg-[#141414] text-white border-[#1B7A6E] shadow-sm' 
                      : 'text-[#888] hover:text-[#ccc] border-transparent hover:bg-[#101010]'
                  }`}
                >
                  <Icon size={14} style={{ color: isActive ? cat.color : '#666' }} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Command Form & Action Dispatch Area */}
          <div className="p-4 md:p-6 space-y-6 flex-1">
            
            {/* CATEGORY 1: DIAGNOSTICS & HEALTH */}
            {selectedCategory === 'diagnostics' && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-[#0f0f0f] border border-[#222] rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Wrench size={16} className="text-[#1B7A6E]" />
                        Hardware &amp; Lead Integrity Self-Test
                      </h3>
                      <p className="text-xs text-[#888] mt-1">
                        Queries the onboard STM32 diagnostic engine via AT command to test continuous ECG channels, accelerometer, and LTE stack.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-[#141414] border border-[#262626] p-4 rounded-md">
                      <div className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                        <Radio size={14} className="text-[#3ADB8F]" />
                        <span>Ping &amp; RSSI Check</span>
                      </div>
                      <p className="text-[11px] text-[#777] mb-3">Check network latency, round-trip time, and cellular signal level.</p>
                      
                      {pingResult && (
                        <div className="p-2.5 mb-3 bg-[#1B7A6E]/10 border border-[#1B7A6E]/30 rounded text-xs font-mono text-[#3ADB8F]">
                          {pingResult}
                        </div>
                      )}

                      <button
                        onClick={handlePing}
                        disabled={isPingRunning}
                        className="w-full py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-[#1B7A6E] rounded text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isPingRunning ? <RefreshCw size={14} className="animate-spin text-[#1B7A6E]" /> : <Send size={13} />}
                        <span>Send AT+CSQ (Ping)</span>
                      </button>
                    </div>

                    <div className="bg-[#141414] border border-[#262626] p-4 rounded-md">
                      <div className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                        <Cpu size={14} className="text-[#1B7A6E]" />
                        <span>Full Diagnostic Suite</span>
                      </div>
                      <p className="text-[11px] text-[#777] mb-3">Perform 7-point self check (leads, IMU, flash, voltage rails, and modem).</p>

                      <button
                        onClick={handleDiagnostic}
                        disabled={isDiagnosticRunning}
                        className="w-full py-2 bg-[#1B7A6E] hover:bg-[#156359] text-white rounded text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isDiagnosticRunning ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={13} />}
                        <span>Run Full Diagnostic Suite</span>
                      </button>
                    </div>
                  </div>

                  {/* Diagnostic Results Checklist */}
                  {diagnosticResults && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border border-[#222] bg-[#141414] rounded-md overflow-hidden">
                      <div className="p-3 bg-[#181818] border-b border-[#222] flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-white">Diagnostic Report for {currentDevice.id}</span>
                        <span className="text-[10px] font-mono text-[#3ADB8F] bg-[#1B7A6E]/20 px-2 py-0.5 rounded border border-[#1B7A6E]/40">ALL CHECKS PASSED</span>
                      </div>
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {diagnosticResults.map((r, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-[#0c0c0c] border border-[#222] rounded text-xs">
                            <span className="text-[#ccc]">{r.name}</span>
                            <span className="flex items-center gap-1 text-[#3ADB8F] font-semibold text-[11px]">
                              <CheckCircle size={13} /> PASS
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* CATEGORY 2: TRANSMISSION & SCHEDULING */}
            {selectedCategory === 'transmission' && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-[#0f0f0f] border border-[#222] rounded-lg p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2 mb-1">
                    <Calendar size={16} className="text-[#3ADB8F]" />
                    Data Transmission &amp; Upload Cadence
                  </h3>
                  <p className="text-xs text-[#888] mb-5">
                    Controls how frequently the hardware connects to cellular LTE-M to transmit recorded ECG and IMU motion packages to Render ML ingest.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#aaa] mb-2">
                          Select Frequency
                        </label>
                        <select
                          value={scheduleInput}
                          onChange={(e) => setScheduleInput(e.target.value)}
                          className="w-full px-3 py-2 bg-[#161616] border border-[#2e2e2e] focus:border-[#1B7A6E] rounded text-xs text-white outline-none"
                        >
                          <option value="Continuous 10s Ingest">Continuous 10s Ingest (Live ECG Mode)</option>
                          <option value="Every 1 hour">Every 1 hour (Periodic Batch)</option>
                          <option value="Every 4 hours">Every 4 hours (Standard Fleet Mode)</option>
                          <option value="Every 12 hours">Every 12 hours (Power Saving)</option>
                          <option value="Once daily">Once daily (Ultra-low Power)</option>
                        </select>
                      </div>

                      <div className="bg-[#141414] border border-[#222] p-3 rounded text-xs text-[#888] space-y-1">
                        <div className="text-white font-semibold flex items-center gap-1">
                          <Activity size={12} className="text-[#1B7A6E]" />
                          <span>Transmission Protocol Details:</span>
                        </div>
                        <p>Current Setting: <strong className="text-[#3ADB8F]">{currentDevice.currentSchedule || 'Every 4 hours'}</strong></p>
                        <p>Target Node: <span className="font-mono text-[#ccc]">{currentDevice.id}</span></p>
                      </div>

                      <button
                        onClick={handleSaveSchedule}
                        disabled={isExecuting}
                        className="w-full py-2.5 bg-[#1B7A6E] hover:bg-[#156359] text-white rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#1B7A6E]/20 disabled:opacity-50"
                      >
                        <Send size={14} />
                        <span>Send Schedule Update to {currentDevice.id}</span>
                      </button>
                    </div>

                    <div className="bg-[#141414] border border-[#262626] p-4 rounded-md flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Zap size={14} className="text-[#3ADB8F]" />
                          Immediate Transmission Override
                        </h4>
                        <p className="text-xs text-[#888] leading-relaxed mb-4">
                          Bypasses the current schedule and commands the device to flush all in-memory ECG telemetry buffers directly to the server immediately.
                        </p>
                      </div>

                      <button
                        onClick={handleImmediateSync}
                        disabled={isExecuting}
                        className="w-full py-2.5 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] hover:border-[#3ADB8F] rounded text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Zap size={14} className="text-[#3ADB8F]" />
                        <span>Dispatch Force Sync (AT+TXSYNC)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CATEGORY 3: SENSOR CONFIGURATION */}
            {selectedCategory === 'config' && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-[#0f0f0f] border border-[#222] rounded-lg p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2 mb-1">
                    <Settings size={16} className="text-[#4A90E2]" />
                    Sensor Sampling Rate &amp; Edge Sensitivity
                  </h3>
                  <p className="text-xs text-[#888] mb-5">
                    Calibrate the ADC sampling resolution for ECG lead channels and the motion shock detection threshold for the 6-axis IMU.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#aaa]">
                        ECG Sampling Rate (ADC Frequency)
                      </label>
                      <select
                        value={samplingRate}
                        onChange={(e) => setSamplingRate(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#161616] border border-[#2e2e2e] focus:border-[#1B7A6E] rounded text-xs text-white outline-none"
                      >
                        <option value={125}>125 Hz (Low Bandwidth - Screening)</option>
                        <option value={250}>250 Hz (Clinical Standard - Default)</option>
                        <option value={500}>500 Hz (High Resolution Arrhythmia Research)</option>
                      </select>
                      <p className="text-[11px] text-[#666]">
                        Higher sampling rates yield sharper QRS complexes but increase cellular payload size.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#aaa] flex justify-between">
                        <span>Lead-Off &amp; Motion Sensitivity</span>
                        <span className="font-mono text-[#1B7A6E]">{lossSensitivity}/10</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={lossSensitivity}
                        onChange={(e) => setLossSensitivity(Number(e.target.value))}
                        className="w-full accent-[#1B7A6E] cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-[#666]">
                        <span>1 (Tolerant)</span>
                        <span>5 (Balanced)</span>
                        <span>10 (Aggressive Alarm)</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#222] flex items-center justify-between">
                    <div className="text-xs text-[#888]">
                      Payload: <code className="text-[#3ADB8F] font-mono text-[11px]">AT+CONFIG=SR:{samplingRate},LS:{lossSensitivity}</code>
                    </div>

                    <button
                      onClick={handleSaveConfig}
                      disabled={isExecuting}
                      className="px-6 py-2.5 bg-[#1B7A6E] hover:bg-[#156359] text-white rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#1B7A6E]/20 disabled:opacity-50"
                    >
                      <Send size={14} />
                      <span>Push Config to {currentDevice.id}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CATEGORY 4: FIRMWARE & OTA */}
            {selectedCategory === 'firmware' && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-[#0f0f0f] border border-[#222] rounded-lg p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2 mb-1">
                    <DownloadCloud size={16} className="text-[#D99B3F]" />
                    Over-The-Air (OTA) Firmware Management
                  </h3>
                  <p className="text-xs text-[#888] mb-5">
                    Remotely deploy signed firmware binaries over cellular LTE-M to the target unit's dual-bank bootloader.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-[#141414] border border-[#262626] rounded-md">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Current Installed Firmware</span>
                      <div className="text-base font-mono font-bold text-white mt-1">
                        {currentDevice.firmwareVersion || 'v4.1.9'}
                      </div>
                      <div className="text-xs text-[#3ADB8F] mt-1 flex items-center gap-1">
                        <CheckCircle size={12} /> Golden partition active
                      </div>
                    </div>

                    <div className="p-4 bg-[#141414] border border-[#262626] rounded-md">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Target Release Available</span>
                      <div className="text-base font-mono font-bold text-[#D99B3F] mt-1 flex items-center gap-2">
                        <span>v4.2.1-prod</span>
                        <span className="text-[9px] font-bold uppercase bg-[#D99B3F]/20 text-[#D99B3F] px-1.5 py-0.5 rounded">New</span>
                      </div>
                      <div className="text-xs text-[#888] mt-1">
                        Enhanced low-power sleep &amp; SIM7080G keep-alive fix
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleFirmwareUpdate}
                      disabled={isExecuting}
                      className="flex-1 py-3 bg-[#D99B3F] hover:bg-[#b8802e] text-black font-black uppercase tracking-wider rounded text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <DownloadCloud size={16} />
                      <span>Push OTA Firmware v4.2.1 to {currentDevice.id}</span>
                    </button>

                    <button
                      onClick={handleFirmwareRollback}
                      disabled={isExecuting}
                      className="px-5 py-3 bg-[#181818] hover:bg-[#242424] border border-[#333] hover:border-[#C4453D] text-[#aaa] hover:text-[#C4453D] rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      <span>Rollback Partition</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CATEGORY 5: LIFECYCLE & EMERGENCY FAILSAFE */}
            {selectedCategory === 'lifecycle' && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-[#0f0f0f] border border-[#222] rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert size={16} className="text-[#C4453D]" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                      Device Lifecycle &amp; Emergency Failsafes
                    </h3>
                  </div>
                  <p className="text-xs text-[#888] mb-5">
                    Critical administrative controls for node reboots, owner de-allocation, full NVRAM wipes, and fleet decommissioning.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Reboot */}
                    <div className="p-4 bg-[#141414] border border-[#262626] rounded-md flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                          <RotateCcw size={14} className="text-[#4A90E2]" />
                          Reboot Hardware (Soft Reset)
                        </h4>
                        <p className="text-xs text-[#777] mb-4">
                          Triggers an immediate watchdog reload and modem reconnect. Device will go offline for 15s.
                        </p>
                      </div>
                      <button
                        onClick={handleRestart}
                        disabled={isExecuting}
                        className="w-full py-2 bg-[#1b1b1b] hover:bg-[#252525] border border-[#333] hover:border-[#4A90E2] text-white rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Reboot Device
                      </button>
                    </div>

                    {/* Unassign */}
                    <div className="p-4 bg-[#141414] border border-[#262626] rounded-md flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                          <User size={14} className="text-[#999]" />
                          Unassign Owner / Patient
                        </h4>
                        <p className="text-xs text-[#777] mb-4">
                          Clears patient metadata while preserving calibration parameters and hardware logs.
                        </p>
                      </div>
                      <button
                        onClick={handleUnassignOwner}
                        disabled={isExecuting}
                        className="w-full py-2 bg-[#1b1b1b] hover:bg-[#252525] border border-[#333] text-white rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Unassign Owner
                      </button>
                    </div>

                    {/* Factory Reset */}
                    <div className="p-4 bg-[#141414] border border-[#C4453D]/30 rounded-md flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-[#C4453D] uppercase tracking-wider mb-1 flex items-center gap-2">
                          <AlertTriangle size={14} />
                          Factory Reset (Wipe Flash)
                        </h4>
                        <p className="text-xs text-[#777] mb-4">
                          Deletes internal ring buffer, resets sampling parameters to 250Hz, and generates fresh encryption tokens. Requires typing device ID to confirm.
                        </p>
                      </div>
                      <button
                        onClick={handleFactoryReset}
                        disabled={isExecuting}
                        className="w-full py-2 bg-[#C4453D]/10 hover:bg-[#C4453D]/20 border border-[#C4453D]/40 text-[#C4453D] rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Factory Reset
                      </button>
                    </div>

                    {/* Decommission */}
                    <div className="p-4 bg-[#141414] border border-[#C4453D]/40 rounded-md flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-[#C4453D] uppercase tracking-wider mb-1 flex items-center gap-2">
                          <Trash2 size={14} />
                          Retire Node (Decommission)
                        </h4>
                        <p className="text-xs text-[#777] mb-4">
                          Permanently removes unit from active fleet monitoring and revokes backend API tokens.
                        </p>
                      </div>
                      <button
                        onClick={handleRetireDevice}
                        disabled={isExecuting}
                        className="w-full py-2 bg-[#C4453D] hover:bg-[#a63932] text-white rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Decommission Unit
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bottom Row: Live Protocol Terminal + Command Audit Log */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              
              {/* Live Terminal Output & Manual Command Prompt */}
              <div className="bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden flex flex-col h-80">
                <div className="p-3 bg-[#111] border-b border-[#222] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-[#3ADB8F]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">Protocol Terminal (Target: {currentDevice.id})</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#3ADB8F] bg-[#3ADB8F]/10 border border-[#3ADB8F]/20 px-1.5 py-0.5 rounded">
                    LIVE STREAM
                  </span>
                </div>

                {/* Console Output */}
                <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-[#bbb] space-y-1 bg-[#050505]">
                  {terminalLogs.map((line, idx) => (
                    <div key={idx} className={`leading-relaxed ${
                      line.includes('[TX]') ? 'text-[#3ADB8F]' :
                      line.includes('[RX]') ? 'text-[#4A90E2]' :
                      line.includes('[ERROR]') ? 'text-[#C4453D]' :
                      line.includes('[OTA]') ? 'text-[#D99B3F]' :
                      line.includes('[NODE SWITCH]') ? 'text-[#1B7A6E] font-bold' :
                      'text-[#888]'
                    }`}>
                      {line}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>

                {/* Manual AT Command Input */}
                <form onSubmit={handleManualCommandSubmit} className="p-2 bg-[#0e0e0e] border-t border-[#222] flex items-center gap-2">
                  <span className="font-mono text-xs text-[#3ADB8F] pl-2">&gt;</span>
                  <input
                    type="text"
                    value={manualCommandInput}
                    onChange={e => setManualCommandInput(e.target.value)}
                    placeholder="Enter AT command (e.g. AT+CSQ, AT+CBC, AT+SYNC)..."
                    className="flex-1 bg-transparent border-none text-xs text-white font-mono outline-none placeholder-[#555]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[#1f1f1f] hover:bg-[#2b2b2b] text-white border border-[#333] rounded text-[11px] font-bold uppercase transition-all cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>

              {/* Dispatched Command Audit Trail */}
              <div className="bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden flex flex-col h-80">
                <div className="p-3 bg-[#111] border-b border-[#222] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[#1B7A6E]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">Dispatched Command Audit Log</span>
                  </div>
                  <span className="text-[10px] text-[#777]">Last {localLog.length} actions</span>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[#0f0f0f] border-b border-[#222] text-[10px] font-bold uppercase tracking-wider text-[#777] sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Command</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Sender</th>
                        <th className="px-3 py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]">
                      {localLog.map((log) => (
                        <tr key={log.id} className="hover:bg-[#141414] transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-white">{log.type}</div>
                            <div className="text-[10px] text-[#777]">{log.detail}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                              log.status === 'Success' ? 'bg-[#1B7A6E]/15 text-[#3ADB8F] border-[#1B7A6E]/30' :
                              log.status === 'Failed' ? 'bg-[#C4453D]/15 text-[#C4453D] border-[#C4453D]/30' :
                              'bg-[#D99B3F]/15 text-[#D99B3F] border-[#D99B3F]/30'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[#888]">{log.sentBy}</td>
                          <td className="px-3 py-2.5 text-[#777] font-mono text-[11px]">{log.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

        </main>

      </div>

      {/* Confirmation Dialog Overlay */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#262626] rounded-lg w-full max-w-md shadow-2xl p-6"
            >
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                {confirmDialog.actionType === 'danger' && <AlertTriangle size={18} className="text-[#C4453D]" />}
                {confirmDialog.title}
              </h3>
              
              <p className="text-xs text-[#aaa] leading-relaxed mb-5">
                {confirmDialog.message}
              </p>
              
              {confirmDialog.requireInputMatch && (
                <div className="mb-5 bg-[#0a0a0a] p-3 border border-[#222] rounded">
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-2">
                    Type <code className="text-[#C4453D] font-mono">{confirmDialog.requireInputMatch}</code> to confirm
                  </label>
                  <input 
                    type="text" 
                    value={confirmInput}
                    onChange={e => setConfirmInput(e.target.value)}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#333] focus:border-[#C4453D] rounded text-xs text-white outline-none font-mono"
                    placeholder={confirmDialog.requireInputMatch}
                    autoFocus
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button 
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 bg-[#1e1e1e] hover:bg-[#282828] border border-[#333] text-[#ccc] hover:text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  disabled={confirmDialog.requireInputMatch ? confirmInput !== confirmDialog.requireInputMatch : false}
                  onClick={confirmDialog.onConfirm}
                  className={`px-5 py-2 font-bold uppercase tracking-wider text-xs rounded transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                    confirmDialog.actionType === 'danger' 
                      ? 'bg-[#C4453D] hover:bg-[#a63932] shadow-lg shadow-[#C4453D]/20' 
                      : 'bg-[#1B7A6E] hover:bg-[#156359] shadow-lg shadow-[#1B7A6E]/20'
                  }`}
                >
                  {confirmDialog.actionLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
