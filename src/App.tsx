import { useState, useEffect } from 'react';
import { ChevronDown, Bell } from 'lucide-react';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import DevicesPage from './components/DevicesPage';
import DeviceFleetDashboard from './components/DeviceFleetDashboard';
import CommandCenter from './components/CommandCenter';
import AlarmPage from './components/AlarmPage';
import TelemetryDashboard from './components/TelemetryDashboard';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [currentView, setCurrentView] = useState<'login' | 'signup' | 'signup_success' | 'devices' | 'dashboard' | 'command_center' | 'alarms' | 'telemetry'>('dashboard');
  const [targetDeviceId, setTargetDeviceId] = useState<string | null>(null);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);

  useEffect(() => {
    // Fetch initial data
    const fetchData = async () => {
      try {
        const [devicesRes, alarmsRes] = await Promise.all([
          fetch('/api/devices'),
          fetch('/api/alarms')
        ]);
        if (devicesRes.ok) setAvailableDevices(await devicesRes.json());
        if (alarmsRes.ok) setAlarms(await alarmsRes.json());
      } catch (err) {
        console.error('Failed to fetch initial app data', err);
      }
    };
    fetchData();
    // Poll alarms every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const navigateToDevices = (deviceId?: string) => {
    setTargetDeviceId(deviceId || null);
    setCurrentView('devices');
  };

  const navigateToCommandCenter = (deviceId: string) => {
    setTargetDeviceId(deviceId);
    setCurrentView('command_center');
  };

  const navigateToTelemetry = (deviceId: string) => {
    setTargetDeviceId(deviceId);
    setCurrentView('telemetry');
  };


  
  const [loginError, setLoginError] = useState<null | 'invalid' | 'locked' | 'network'>(null);
  const [signupDuplicateError, setSignupDuplicateError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleLoginSubmit = (email: string) => {
    setIsLoading(true);
    setLoginError(null);
    
    setTimeout(() => {
      setIsLoading(false);
      
      if (email.toLowerCase().includes('network')) {
        setLoginError('network');
        return;
      }

      if (email === 'admin' || email === 'support' || email === 'it.support@pulse.io' || email === 'admin@pulse.io') {
        setCurrentView('devices');
        setFailedAttempts(0);
        return;
      }

      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        setLoginError('locked');
      } else {
        setLoginError('invalid');
      }
    }, 800);
  };

  const handleSignUpSubmit = (formData: any) => {
    setIsLoading(true);
    setSignupDuplicateError(false);
    
    setTimeout(() => {
      setIsLoading(false);
      
      if (formData.email.toLowerCase().includes('duplicate')) {
        setSignupDuplicateError(true);
      } else {
        setCurrentView('signup_success');
      }
    }, 800);
  };

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <>
      {currentView === 'login' ? (
        <LoginPage 
          onLoginSubmit={handleLoginSubmit}
          onNavigateToSignUp={() => setCurrentView('signup')}
          isLoading={isLoading}
          errorState={loginError}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      ) : currentView === 'signup' || currentView === 'signup_success' ? (
        <SignUpPage 
          onSignUpSubmit={handleSignUpSubmit}
          onReturnToLogin={() => setCurrentView('login')}
          onNavigateToLogin={() => setCurrentView('login')}
          initialRole={null}
          isLoading={isLoading}
          isSuccess={currentView === 'signup_success'}
          duplicateEmailError={signupDuplicateError}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      ) : (
        <div className="h-screen w-full flex flex-col bg-light-bg dark:bg-[#000000]">
          {/* TopBar */}
          <div className="bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#262626] px-4 py-2.5 flex justify-between items-center text-light-text dark:text-white shrink-0 relative z-50">
            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
                  className="flex items-center gap-2 font-bold text-sm tracking-widest uppercase text-[#1B7A6E] outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-sm p-1 -ml-1"
                >
                  Pulse Platform <ChevronDown size={16} className={`transform transition-transform ${isNavMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isNavMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm shadow-xl overflow-hidden py-1">
                    <button 
                      onClick={() => { setCurrentView('dashboard'); setIsNavMenuOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-[#1a1a1a] ${currentView === 'dashboard' ? 'bg-[#1B7A6E]/10 text-[#1B7A6E]' : 'text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}
                    >
                      Dashboard
                    </button>
                    <button 
                      onClick={() => { setCurrentView('devices'); setIsNavMenuOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-[#1a1a1a] ${currentView === 'devices' ? 'bg-[#1B7A6E]/10 text-[#1B7A6E]' : 'text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}
                    >
                      Devices
                    </button>
                    <button 
                      onClick={() => { setCurrentView('alarms'); setIsNavMenuOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-[#1a1a1a] ${currentView === 'alarms' ? 'bg-[#1B7A6E]/10 text-[#1B7A6E]' : 'text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}
                    >
                      Alarms
                    </button>
                    <button 
                      onClick={() => { navigateToCommandCenter('DEV-0198'); setIsNavMenuOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-[#1a1a1a] ${currentView === 'command_center' ? 'bg-[#1B7A6E]/10 text-[#1B7A6E]' : 'text-light-text-secondary dark:text-[#9A9A9A] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] hover:text-light-text dark:hover:text-[#F2F2F2]'}`}
                    >
                      Command Center
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setCurrentView('alarms')}
                className="relative text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-[#F2F2F2] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B7A6E] rounded-full p-1"
              >
                <Bell size={18} />
                {alarms.filter(a => a.status === 'Active').length > 0 && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-[#C4453D] rounded-full border border-white dark:border-black" />
                )}
              </button>
              <button onClick={toggleTheme} className="text-[10px] uppercase tracking-widest font-bold text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-white transition-colors cursor-pointer outline-none focus-visible:underline">
                Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode
              </button>
              <button onClick={() => setCurrentView('login')} className="text-[10px] uppercase tracking-widest font-bold text-light-text-secondary dark:text-[#9A9A9A] hover:text-light-text dark:hover:text-white transition-colors cursor-pointer outline-none focus-visible:underline">
                Log Out
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {currentView === 'dashboard' && (
                <DeviceFleetDashboard 
                  availableDevices={availableDevices}
                  onSearchDevice={(id) => navigateToCommandCenter(id)}
                  onNavigateToDevices={() => navigateToDevices()}
                  onViewDevice={(id) => navigateToDevices(id)}
                  onMetricClick={(metric) => {
                    if (metric === 'total-devices' || metric === 'online' || metric === 'offline' || metric === 'firmware-pending') {
                      navigateToDevices();
                    }
                  }}
                  onNavigateToCommandCenter={(id) => navigateToCommandCenter(id)}
                  onViewCommand={(id) => navigateToCommandCenter(id)}
                />
              )}
              {currentView === 'alarms' && (
                <AlarmPage 
                  alarms={alarms}
                  onAcknowledge={(id) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, status: 'Acknowledged', history: [...(a.history || []), { timestamp: new Date().toISOString(), action: 'Acknowledged', user: 'Admin' }] } : a))}
                  onResolve={(id, note) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, status: 'Resolved', history: [...(a.history || []), { timestamp: new Date().toISOString(), action: 'Resolved', user: 'Admin', note }] } : a))}
                  onReopen={(id) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, status: 'Active', history: [...(a.history || []), { timestamp: new Date().toISOString(), action: 'Reopened', user: 'Admin' }] } : a))}
                  onAssign={(id, staffId) => setAlarms(prev => prev.map(a => a.id === id ? { ...a, assignedTo: staffId, history: [...(a.history || []), { timestamp: new Date().toISOString(), action: 'Assigned', user: 'Admin', note: `Assigned to ${staffId}` }] } : a))}
                  onViewDevice={(id) => navigateToDevices(id)}
                />
              )}
              {currentView === 'devices' && (
                <DevicesPage 
                  devices={availableDevices}
                  initialSelectedDeviceId={targetDeviceId} 
                  onManageCommands={(id) => navigateToCommandCenter(id)}
                  onViewTelemetry={(id) => navigateToTelemetry(id)}
                />
              )}
              {currentView === 'command_center' && (() => {
                const device = availableDevices.find(d => d.id === targetDeviceId) || availableDevices[0] || {
                  id: targetDeviceId || 'DEV-0198',
                  serialNumber: 'SN-9345-8201',
                  ownerName: 'Alice Smith',
                  connectivityStatus: 'Online',
                  batteryLevel: 85,
                  signalStrength: 4,
                  lastSync: '2 min ago',
                  firmwareVersion: 'v4.1.9',
                  firmwareUpdateAvailable: true,
                  currentSchedule: 'Every 4 hours',
                  samplingRate: 250,
                  onDeviceThresholds: { lossSensitivity: 5 }
                };

                return (
                  <CommandCenter 
                    device={device}
                    availableDevices={availableDevices}
                    onChangeDevice={(id) => setTargetDeviceId(id)}
                    onBack={() => navigateToDevices(targetDeviceId || undefined)}
                    onViewDataAnalysis={(id) => navigateToDevices(id)}
                    onViewTelemetry={(id) => navigateToTelemetry(id)}
                  />
                );
              })()}
              {currentView === 'telemetry' && (
                <div className="h-full w-full p-6">
                  <div className="h-full w-full">
                    <TelemetryDashboard 
                      deviceId={targetDeviceId || 'DEV-0198'} 
                      context="device-detail" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
