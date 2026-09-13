import { AlertCircle, ArrowRight, BatteryMedium, Clock3, Database, Radio, Server, UploadCloud } from 'lucide-react';
import { formatUploadAge } from '../lib/telemetry-contract.mjs';
import type { DeviceSummary } from '../types';

interface Props {
  devices: DeviceSummary[];
  loading: boolean;
  error: string | null;
  onOpenDevice: (deviceId: string) => void;
}

const statusStyle = {
  recent: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  delayed: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  stale: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  never: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

export default function DeviceFleetDashboard({ devices, loading, error, onOpenDevice }: Props) {
  const totals = devices.reduce((result, device) => {
    result[device.uploadStatusKey] += 1;
    result.sessions += device.sessionCount || 0;
    result.samples += device.totalSamples || 0;
    return result;
  }, { recent: 0, delayed: 0, stale: 0, never: 0, sessions: 0, samples: 0 });

  const metrics = [
    { label: 'Registered devices', value: devices.length, icon: Server, color: 'text-slate-600 dark:text-slate-300' },
    { label: 'Recent uploads', value: totals.recent, icon: UploadCloud, color: 'text-emerald-600 dark:text-emerald-300' },
    { label: 'Delayed or stale', value: totals.delayed + totals.stale, icon: Clock3, color: 'text-amber-600 dark:text-amber-300' },
    { label: 'Stored recordings', value: totals.sessions, icon: Database, color: 'text-[#1B7A6E] dark:text-[#55c8b7]' },
  ];
  const latestDevice = devices.reduce<DeviceSummary | null>((latest, device) => {
    if (!device.lastUploadAt) return latest;
    if (!latest?.lastUploadAt) return device;
    return new Date(device.lastUploadAt).getTime() > new Date(latest.lastUploadAt).getTime()
      ? device
      : latest;
  }, null);

  return (
    <div className="h-full overflow-y-auto px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="flex flex-col gap-3 border-b border-black/10 pb-7 dark:border-white/10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#1B7A6E] dark:text-[#55c8b7]">Upload-backed status</p>
            <h1 className="text-3xl font-semibold tracking-tight">TirtaTrace overview</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55 dark:text-white/55">
              Status reflects the age of the last complete recording received by the server. It does not claim a continuous connection to the board.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-black/45 dark:text-white/45">
            <Radio size={14} /> Auto-refreshes every 10 seconds
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle size={17} /> {error}
          </div>
        )}

        {!loading && latestDevice && (
          <section className="overflow-hidden rounded-2xl border border-[#1B7A6E]/25 bg-gradient-to-br from-[#123f39] to-[#0c2825] text-white shadow-xl shadow-[#1B7A6E]/10">
            <div className="grid gap-6 px-6 py-6 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.7fr))_auto] md:items-center md:px-7">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#77d8ca]">Latest upload</p>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${statusStyle[latestDevice.uploadStatusKey]}`}>
                    {latestDevice.uploadStatus}
                  </span>
                </div>
                <p className="mt-3 truncate font-mono text-base font-semibold">{latestDevice.id}</p>
                <p className="mt-1 truncate text-xs text-white/55">{latestDevice.ownerName || 'No owner assigned'}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/45">Received</p>
                <p className="mt-2 text-sm font-semibold">{formatUploadAge(latestDevice.lastUploadAt)}</p>
                <p className="mt-1 text-[10px] text-white/45">{new Date(latestDevice.lastUploadAt!).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/45">Battery rail</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
                  <BatteryMedium size={15} className="text-[#77d8ca]" />
                  {latestDevice.batteryVoltageMv === null ? 'Not measured' : `${(latestDevice.batteryVoltageMv / 1000).toFixed(3)} V`}
                </p>
                <p className="mt-1 text-[10px] text-white/45">Measured during upload</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/45">Stored recordings</p>
                <p className="mt-2 text-sm font-semibold tabular-nums">{latestDevice.sessionCount.toLocaleString()}</p>
                <p className="mt-1 text-[10px] text-white/45">{latestDevice.totalSamples.toLocaleString()} samples</p>
              </div>
              <button
                onClick={() => onOpenDevice(latestDevice.id)}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#123f39] transition-colors hover:bg-[#e5f7f3]"
              >
                Open recording <ArrowRight size={14} />
              </button>
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">{label}</span>
                <Icon size={16} className={color} />
              </div>
              <p className={`mt-5 text-3xl font-semibold tracking-tight ${color}`}>{loading ? '—' : value.toLocaleString()}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
            <div>
              <h2 className="text-sm font-semibold">Registered boards</h2>
              <p className="mt-1 text-xs text-black/45 dark:text-white/45">Open a board to inspect its stored recording batches.</p>
            </div>
            <span className="text-xs tabular-nums text-black/45 dark:text-white/45">{totals.samples.toLocaleString()} samples stored</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-black/45 dark:text-white/45">Loading registered boards…</div>
          ) : devices.length === 0 ? (
            <div className="p-12 text-center">
              <Database className="mx-auto mb-3 text-black/25 dark:text-white/25" size={28} />
              <p className="font-semibold">No registered boards</p>
              <p className="mt-1 text-sm text-black/45 dark:text-white/45">Register a firmware UID in the production database before uploading.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {devices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => onOpenDevice(device.id)}
                  className="grid w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.03] md:grid-cols-[minmax(0,1.6fr)_0.7fr_0.75fr_0.75fr_0.75fr_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold">{device.id}</p>
                    <p className="mt-1 truncate text-xs text-black/45 dark:text-white/45">{device.ownerName || 'No owner assigned'}</p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusStyle[device.uploadStatusKey]}`}>
                    {device.uploadStatus}
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 dark:text-white/40">Last upload</p>
                    <p className="mt-1 text-xs font-semibold">{formatUploadAge(device.lastUploadAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 dark:text-white/40">Recordings</p>
                    <p className="mt-1 text-xs font-semibold tabular-nums">{device.sessionCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-black/40 dark:text-white/40">Battery</p>
                    <p className="mt-1 text-xs font-semibold tabular-nums">
                      {device.batteryVoltageMv === null ? '—' : `${(device.batteryVoltageMv / 1000).toFixed(3)} V`}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-black/30 dark:text-white/30" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
