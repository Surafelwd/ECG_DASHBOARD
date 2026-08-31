import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Bell, X, AlertTriangle, CheckCircle, Clock, Moon, Sun, LogOut, User } from 'lucide-react';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import DevicesPage from './components/DevicesPage';
import DeviceFleetDashboard from './components/DeviceFleetDashboard';
import CommandCenter from './components/CommandCenter';
import AlarmPage from './components/AlarmPage';
import TelemetryDashboard from './components/TelemetryDashboard';
import FleetMapPage from './components/FleetMapPage';
import {
  DEMO_DEVICES, DEMO_ALARMS, DEMO_CONNECTIVITY_TREND,
  DEMO_ALARM_TREND, DEMO_FIRMWARE_BREAKDOWN, DEMO_ACTIVITY, DEMO_SPARKLINES,
} from './demoData';

type ViewType = 'login' | 'signup' | 'signup_success' | 'devices' | 'dashboard' | 'command_center' | 'alarms' | 'telemetry' | 'fleet_map';

// ── Notification Center ───────────────────────────────────────────────────────
function NotificationCenter({
  alarms, onClose, onViewAlarm, onAcknowledge,
}: {
  alarms: any[]; onClose: () => void;
  onViewAlarm: (id: string) => void; onAcknowledge: (id: string) => void;
}) {
  const active = alarms.filter(a => a.status === 'Active' || a.status === 'unacknowledged');
  const recent = alarms.slice(0, 8);

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm shadow-2xl z-[100] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[#1B7A6E]" />
          <span className="text-xs font-bold uppercase tracking-widest">Notifications</span>
          {active.length > 0 && (
            <span className="bg-[#C4453D] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{active.length}</span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={14} />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-[#1a1a1a]">
        {recent.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle size={24} className="mx-auto text-[#1B7A6E] mb-2 opacity-40" />
            <p className="text-xs text-gray-400 dark:text-[#9A9A9A]">No notifications</p>
          </div>
        ) : recent.map(alarm => {
          const isActive = alarm.status === 'Active' || alarm.status === 'unacknowledged';
          const sev = alarm.severity === 'Critical' || alarm.severity === 'critical';
          return (
            <div key={alarm.id} className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] ${isActive ? 'border-l-2 border-l-[#C4453D]' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {sev ? <AlertTriangle size={11} className="text-[#C4453D] shrink-0" /> : <Bell size={11} className="text-[#D99B3F] shrink-0" />}
                    <span className="text-xs font-bold truncate text-light-text dark:text-dark-text">{alarm.alarmType}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-[#9A9A9A]">{alarm.deviceId} · {alarm.severity}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold ${
                    alarm.status === 'Active' || alarm.status === 'unacknowledged'
                      ? 'bg-[#C4453D]/10 text-[#C4453D]'
                      : alarm.status === 'Acknowledged'
                      ? 'bg-[#D99B3F]/10 text-[#D99B3F]'
                      : 'bg-[#1B7A6E]/10 text-[#1B7A6E]'
                  }`}>{alarm.status === 'unacknowledged' ? 'Active' : alarm.status}</span>
                  {isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAcknowledge(alarm.id); }}
                      className="text-[9px] font-bold text-[#1B7A6E] hover:underline"
                    >
                      Ack
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0a0a0a]">
        <button onClick={() => { onViewAlarm('all'); onClose(); }} className="text-[10px] font-bold uppercase tracking-widest text-[#1B7A6E] hover:underline">
          View all alarms →
        </button>
      </div>
    </div>
  );
}

// ── Critical Alarm Banner ─────────────────────────────────────────────────────
function CriticalAlarmBanner({ alarms, onNavigateToAlarms }: { alarms: any[]; onNavigateToAlarms: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const critical = alarms.filter(a =>
    (a.severity === 'Critical' || a.severity === 'critical') &&
    (a.status === 'Active' || a.status === 'unacknowledged')
  );

  if (critical.length === 0 || dismissed) return null;

  return (
    <div className="flex-none flex items-center justify-between gap-4 px-4 py-2 bg-[#C4453D] text-white text-xs font-bold">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="animate-pulse shrink-0" />
        <span>
          {critical.length} critical alarm{critical.length > 1 ? 's' : ''} require{critical.length === 1 ? 's' : ''} immediate attention
          {critical[0] && ` — ${critical[0].alarmType} on ${critical[0].deviceId}`}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={onNavigateToAlarms} className="underline hover:no-underline">
          Review now
        </button>
        <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [targetDeviceId, setTargetDeviceId] = useState<string | null>(null);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);

  // Auth state
  const [loginError, setLoginError] = useState<null | 'invalid' | 'locked' | 'network'>(null);
  const [signupDuplicateError, setSignupDuplicateError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Demo data: activate only when API returns nothing
  const usingDemo = availableDevices.length === 0;
  const devices = usingDemo ? DEMO_DEVICES : availableDevices;
  const allAlarms = usingDemo ? DEMO_ALARMS : alarms;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [devicesRes, alarmsRes] = await Promise.all([
          fetch('/api/devices'),
          fetch('/api/alarms'),
        ]);
        if (devicesRes.ok) setAvailableDevices(await devicesRes.json());
        if (alarmsRes.ok) setAlarms(await alarmsRes.json());
      } catch (err) {
        console.error('Failed to fetch initial app data', err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Close dropdowns when clicking outside
  const navRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setIsNavMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navigateToDevices = (deviceId?: string) => {
    setTargetDeviceId(deviceId || null);
    setCurrentView('devices');
    setIsNavMenuOpen(false);
  };
  const navigateToCommandCenter = (deviceId: string) => {
    setTargetDeviceId(deviceId);
    setCurrentView('command_center');
    setIsNavMenuOpen(false);
  };
  const navigateToTelemetry = (deviceId: string) => {
    setTargetDeviceId(deviceId);
    setCurrentView('telemetry');
  };
  const navigateToAlarms = () => {
    setCurrentView('alarms');
    setIsNavMenuOpen(false);
  };

  const handleAcknowledge = (id: string) =>
    setAlarms(prev => prev.map(a => a.id === id
      ? { ...a, status: 'Acknowledged', history: [...(a.history || []), { timestamp: new Date().toISOString(), action: 'Acknowledged', user: 'Admin' }] }
      : a));

  const handleLoginSubmit = (email: string) => {
    setIsLoading(true);
    setLoginError(null);
    setTimeout(() => {
      setIsLoading(false);
      if (email.toLowerCase().includes('network')) { setLoginError('network'); return; }
      if (['admin', 'support', 'it.support@pulse.io', 'admin@pulse.io'].includes(email)) {
        setCurrentView('dashboard'); setFailedAttempts(0); return;
      }
      const n = failedAttempts + 1;
      setFailedAttempts(n);
      setLoginError(n >= 5 ? 'locked' : 'invalid');
    }, 800);
  };

  const handleSignUpSubmit = (formData: any) => {
    setIsLoading(true);
    setSignupDuplicateError(false);
    setTimeout(() => {
      setIsLoading(false);
      if (formData.email.toLowerCase().includes('duplicate')) setSignupDuplicateError(true);
      else setCurrentView('signup_success');
    }, 800);
  };

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  const activeAlarmCount = allAlarms.filter(a => a.status === 'Active' || a.status === 'unacknowledged').length;
  const isAuthView = currentView === 'login' || currentView === 'signup' || currentView === 'signup_success';

  if (currentView === 'login') {
    return (
      <LoginPage onLoginSubmit={handleLoginSubmit} onNavigateToSignUp={() => setCurrentView('signup')}
        isLoading={isLoading} errorState={loginError} theme={theme} toggleTheme={toggleTheme} />
    );
  }
  if (currentView === 'signup' || currentView === 'signup_success') {
    return (
      <SignUpPage onSignUpSubmit={handleSignUpSubmit} onReturnToLogin={() => setCurrentView('login')}
        onNavigateToLogin={() => setCurrentView('login')} initialRole={null}
        isLoading={isLoading} isSuccess={currentView === 'signup_success'}
        duplicateEmailError={signupDuplicateError} theme={theme} toggleTheme={toggleTheme} />
    );
  }

  const commandDevice = devices.find(d => d.id === targetDeviceId) || devices[0] || {
    id: targetDeviceId || 'DEV-0198', serialNumber: 'SN-9345-8201', ownerName: 'Alice Smith',
    connectivityStatus: 'Online', batteryLevel: 85, signalStrength: 4, lastSync: '2 min ago',
    firmwareVersion: 'v4.1.9', firmwareUpdateAvailable: true, currentSchedule: 'Every 4 hours',
    samplingRate: 250, onDeviceThresholds: { lossSensitivity: 5 },
  };

  const NAV_LINKS = [
    { id: 'dashboard',      label: 'Dashboard' },
    { id: 'devices',        label: 'Devices' },
    { id: 'fleet_map',      label: 'Fleet Map' },
    { id: 'alarms',         label: 'Alarms' },
    { id: 'command_center', label: 'Command Center' },
  ];

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'dark bg-mesh-dark text-white' : 'bg-light-bg text-light-text'}`}>

      {/* ── TopBar ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#262626] px-4 py-2.5 flex justify-between items-center text-light-text dark:text-white shrink-0 relative z-50">

        {/* Left: brand + nav dropdown */}
        <div className="flex items-center gap-6">
          <div ref={navRef} className="relative">
            <button
              onClick={() => setIsNavMenuOpen(o => !o)}
              className="flex items-center gap-2 font-bold text-sm tracking-widest uppercase text-[#1B7A6E] outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm p-1 -ml-1"
            >
              Pulse Platform
              <ChevronDown size={15} className={`transition-transform ${isNavMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isNavMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm shadow-xl overflow-hidden py-1">
                {NAV_LINKS.map(link => (
                  <button key={link.id}
                    onClick={() => {
                      if (link.id === 'command_center') navigateToCommandCenter(devices[0]?.id || 'DEV-0198');
                      else if (link.id === 'devices') navigateToDevices();
                      else if (link.id === 'alarms') navigateToAlarms();
                      else { setCurrentView(link.id as ViewType); setIsNavMenuOpen(false); }
                    }}
                    className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors outline-none ${
                      currentView === link.id
                        ? 'bg-[#1B7A6E]/10 text-[#1B7A6E]'
                        : 'text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] hover:text-light-text dark:hover:text-[#F2F2F2]'
                    }`}
                  >
                    {link.label}
                    {link.id === 'alarms' && activeAlarmCount > 0 && (
                      <span className="ml-2 bg-[#C4453D] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{activeAlarmCount}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Inline nav pills (desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <button key={link.id}
                onClick={() => {
                  if (link.id === 'command_center') navigateToCommandCenter(devices[0]?.id || 'DEV-0198');
                  else if (link.id === 'devices') navigateToDevices();
                  else if (link.id === 'alarms') navigateToAlarms();
                  else setCurrentView(link.id as ViewType);
                }}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-colors relative ${
                  currentView === link.id
                    ? 'text-[#1B7A6E] bg-[#1B7A6E]/8'
                    : 'text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2]'
                }`}
              >
                {link.label}
                {link.id === 'alarms' && activeAlarmCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#C4453D] text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {activeAlarmCount > 9 ? '9+' : activeAlarmCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: user info + actions */}
        <div className="flex items-center gap-3">
          {/* Demo badge */}
          {usingDemo && (
            <span className="hidden sm:flex items-center text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-[#D99B3F]/10 text-[#D99B3F] border border-[#D99B3F]/20 rounded-sm">
              Demo Data
            </span>
          )}

          {/* Notification bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setIsNotifOpen(o => !o)}
              className="relative text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-full p-1"
            >
              <Bell size={18} />
              {activeAlarmCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#C4453D] text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeAlarmCount > 9 ? '9+' : activeAlarmCount}
                </span>
              )}
            </button>
            {isNotifOpen && (
              <NotificationCenter
                alarms={allAlarms}
                onClose={() => setIsNotifOpen(false)}
                onViewAlarm={() => { navigateToAlarms(); setIsNotifOpen(false); }}
                onAcknowledge={(id) => { handleAcknowledge(id); }}
              />
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2] transition-colors p-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* User avatar */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-[#262626]">
            <div className="w-7 h-7 rounded-full bg-[#1B7A6E]/15 flex items-center justify-center">
              <User size={14} className="text-[#1B7A6E]" />
            </div>
            <div className="hidden lg:block text-right">
              <div className="text-[10px] font-bold text-light-text dark:text-[#F2F2F2] leading-tight">Admin</div>
              <div className="text-[9px] text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-widest">Administrator</div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => setCurrentView('login')}
            className="text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#C4453D] transition-colors p-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E]"
            title="Log Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* ── Critical Alarm Banner ────────────────────────────────────────── */}
      <CriticalAlarmBanner alarms={allAlarms} onNavigateToAlarms={navigateToAlarms} />

      {/* ── Page Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'dashboard' && (
          <DeviceFleetDashboard
            availableDevices={devices}
            alarms={allAlarms}
            connectivityTrendData={DEMO_CONNECTIVITY_TREND}
            alarmTrendData={DEMO_ALARM_TREND}
            firmwareBreakdown={DEMO_FIRMWARE_BREAKDOWN}
            recentActivity={DEMO_ACTIVITY}
            sparklines={DEMO_SPARKLINES}
            onSearchDevice={(id) => navigateToCommandCenter(id)}
            onNavigateToDevices={() => navigateToDevices()}
            onNavigateToAlarms={navigateToAlarms}
            onViewDevice={(id) => navigateToDevices(id)}
            onMetricClick={(metric) => {
              if (['total-devices', 'online', 'offline', 'firmware-pending'].includes(metric)) navigateToDevices();
              if (metric === 'active-alarms') navigateToAlarms();
            }}
            onNavigateToCommandCenter={(id) => navigateToCommandCenter(id)}
            onViewCommand={(id) => navigateToCommandCenter(id)}
            onViewAlarm={() => navigateToAlarms()}
          />
        )}
        {currentView === 'alarms' && (
          <AlarmPage
            alarms={allAlarms}
            onAcknowledge={handleAcknowledge}
            onResolve={(id, note) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, status: 'Resolved', history: [...(a.history || []), { timestamp: new Date().toISOString(), action: 'Resolved', user: 'Admin', note }] } : a))}
            onReopen={(id) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, status: 'Active', history: [...(a.history || []), { timestamp: new Date().toISOString(), action: 'Reopened', user: 'Admin' }] } : a))}
            onAssign={(id, staffId) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, assignedTo: staffId, history: [...(a.history || []), { timestamp: new Date().toISOString(), action: 'Assigned', user: 'Admin', note: `Assigned to ${staffId}` }] } : a))}
            onViewDevice={(id) => navigateToDevices(id)}
          />
        )}
        {currentView === 'devices' && (
          <DevicesPage
            devices={devices}
            initialSelectedDeviceId={targetDeviceId}
            onManageCommands={(id) => navigateToCommandCenter(id)}
            onViewTelemetry={(id) => navigateToTelemetry(id)}
          />
        )}
        {currentView === 'command_center' && (
          <CommandCenter
            device={commandDevice}
            availableDevices={devices}
            onChangeDevice={(id) => setTargetDeviceId(id)}
            onBack={() => navigateToDevices(targetDeviceId || undefined)}
            onViewDataAnalysis={(id) => navigateToDevices(id)}
            onViewTelemetry={(id) => navigateToTelemetry(id)}
          />
        )}
        {currentView === 'fleet_map' && (
          <FleetMapPage
            devices={devices}
            onViewDevice={(id) => navigateToCommandCenter(id)}
          />
        )}
        {currentView === 'telemetry' && (
          <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-[#050505] overflow-hidden">
            <div className="w-full max-w-7xl h-full relative z-0 shadow-2xl">
              <TelemetryDashboard deviceId={targetDeviceId || 'DEV-0198'} context="device-detail" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
