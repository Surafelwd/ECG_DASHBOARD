import { useEffect, useState } from 'react';
import { Activity, LayoutDashboard, ListTree, Moon, RefreshCw, Sun } from 'lucide-react';
import DeviceFleetDashboard from './components/DeviceFleetDashboard';
import DevicesPage from './components/DevicesPage';
import type { DeviceSummary } from './types';

type View = 'dashboard' | 'devices';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      if (!response.ok) throw new Error(`Device request failed with HTTP ${response.status}`);
      const result = await response.json();
      setDevices(Array.isArray(result) ? result : []);
      setError(null);
    } catch {
      setError('The telemetry API could not be reached.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const timer = window.setInterval(loadDevices, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const openDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setView('devices');
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#16201f] dark:bg-[#070a0a] dark:text-[#eef6f4]">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#0b0f0e]/95">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-3 md:px-8">
          <button className="flex items-center gap-3" onClick={() => setView('dashboard')}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1B7A6E] text-white shadow-lg shadow-[#1B7A6E]/20">
              <Activity size={19} />
            </span>
            <span className="text-left">
              <span className="block text-sm font-semibold tracking-tight">ECG Telemetry</span>
              <span className="block text-[10px] uppercase tracking-[0.22em] text-black/45 dark:text-white/45">V1 recording monitor</span>
            </span>
          </button>

          <nav className="flex items-center gap-1 rounded-xl border border-black/10 bg-black/[0.025] p-1 dark:border-white/10 dark:bg-white/[0.035]">
            {([
              ['dashboard', 'Overview', LayoutDashboard],
              ['devices', 'Recordings', ListTree],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  view === id
                    ? 'bg-white text-[#1B7A6E] shadow-sm dark:bg-white/10 dark:text-[#55c8b7]'
                    : 'text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDevices}
              className="rounded-lg border border-black/10 p-2 text-black/55 hover:text-[#1B7A6E] dark:border-white/10 dark:text-white/55"
              title="Refresh devices"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              className="rounded-lg border border-black/10 p-2 text-black/55 hover:text-[#1B7A6E] dark:border-white/10 dark:text-white/55"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto h-[calc(100vh-65px)] max-w-[1440px] overflow-hidden">
        {view === 'dashboard' ? (
          <DeviceFleetDashboard devices={devices} loading={loading} error={error} onOpenDevice={openDevice} />
        ) : (
          <DevicesPage devices={devices} initialDeviceId={selectedDeviceId} onSelectDevice={setSelectedDeviceId} />
        )}
      </main>
    </div>
  );
}
