import { Database, Search } from 'lucide-react';
import { formatUploadAge } from '../lib/telemetry-contract.mjs';
import type { DeviceSummary } from '../types';
import TelemetryDashboard from './TelemetryDashboard';

interface Props {
  devices: DeviceSummary[];
  initialDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
}

export default function DevicesPage({ devices, initialDeviceId, onSelectDevice }: Props) {
  const selectedId = initialDeviceId && devices.some((device) => device.id === initialDeviceId)
    ? initialDeviceId
    : devices[0]?.id || null;
  const selected = devices.find((device) => device.id === selectedId);

  return (
    <div className="grid h-full md:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="overflow-y-auto border-r border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.02]">
        <div className="sticky top-0 z-10 border-b border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#0b0f0e]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database size={15} className="text-[#1B7A6E]" /> Recording sources
          </div>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">{devices.length} registered board{devices.length === 1 ? '' : 's'}</p>
        </div>

        {devices.length === 0 ? (
          <div className="p-6 text-center text-sm text-black/45 dark:text-white/45">
            <Search className="mx-auto mb-3 opacity-40" size={24} />
            No registered boards are available.
          </div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => onSelectDevice(device.id)}
                className={`w-full px-4 py-4 text-left transition-colors ${
                  selectedId === device.id
                    ? 'bg-[#1B7A6E]/8 shadow-[inset_3px_0_0_#1B7A6E]'
                    : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.03]'
                }`}
              >
                <p className="truncate font-mono text-xs font-semibold">{device.id}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="truncate text-xs text-black/45 dark:text-white/45">{device.ownerName || 'Unassigned'}</span>
                  <span className="shrink-0 text-[10px] font-semibold text-[#1B7A6E] dark:text-[#55c8b7]">{formatUploadAge(device.lastUploadAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="min-w-0 overflow-hidden">
        {selected ? (
          <TelemetryDashboard deviceId={selected.id} ownerName={selected.ownerName} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-black/45 dark:text-white/45">Select a registered board.</div>
        )}
      </section>
    </div>
  );
}
