import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, ChevronDown, Clock3, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ECG_CH2_MV_PER_COUNT, EXPECTED_V1_SAMPLE_COUNT } from '../lib/telemetry-contract.mjs';
import { useTelemetryStream, type SessionMeta, type TelemetryPoint } from '../hooks/useTelemetryStream';

interface Props {
  deviceId: string;
  ownerName?: string;
}

interface Trace {
  key: keyof TelemetryPoint;
  name: string;
  color: string;
  type?: 'linear' | 'stepAfter';
}

function formatRecordingDuration(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

function formatRecordingLabel(session: SessionMeta) {
  return new Date(session.receivedAt || session.endTime).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function SessionPicker({ sessions, selectedId, onSelect }: {
  sessions: SessionMeta[];
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = sessions.find((session) => session.sessionId === selectedId);

  if (sessions.length === 0) return <span className="text-xs text-black/45 dark:text-white/45">No recordings received</span>;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
      >
        <Database size={13} className="text-[#1B7A6E]" />
        {selected ? formatRecordingLabel(selected) : 'Select recording'}
        <ChevronDown size={13} className="text-black/40 dark:text-white/40" />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label="Close recording menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 max-h-80 w-80 overflow-y-auto rounded-xl border border-black/10 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-[#121817]">
            {sessions.map((session, index) => (
              <button
                key={session.sessionId}
                onClick={() => { onSelect(session.sessionId); setOpen(false); }}
                className={`w-full rounded-lg px-3 py-3 text-left hover:bg-black/[0.035] dark:hover:bg-white/[0.05] ${session.sessionId === selectedId ? 'bg-[#1B7A6E]/8' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold">{index === 0 ? 'Latest · ' : ''}{formatRecordingLabel(session)}</span>
                  <span className="text-[10px] tabular-nums text-black/45 dark:text-white/45">{session.sampleCount.toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[10px] text-black/40 dark:text-white/40">Received by server · capture time estimated</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-black/8 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/[0.035]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/40">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold text-[#1B7A6E] dark:text-[#55c8b7]">{value}</p>
      <p className="mt-1 text-[10px] text-black/40 dark:text-white/40">{note}</p>
    </div>
  );
}

function TraceChart({ title, subtitle, data, traces, unit, footer }: {
  title: string;
  subtitle: string;
  data: TelemetryPoint[];
  traces: Trace[];
  unit: string;
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/8 px-5 py-4 dark:border-white/8">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {traces.map((trace) => (
            <span key={String(trace.key)} className="flex items-center gap-1.5 text-[10px] font-semibold text-black/50 dark:text-white/50">
              <span className="h-0.5 w-3" style={{ backgroundColor: trace.color }} /> {trace.name}
            </span>
          ))}
        </div>
      </div>
      <div className="h-80 px-2 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 16, left: 0, bottom: 14 }}>
            <CartesianGrid strokeDasharray="3 5" vertical={false} opacity={0.18} />
            <XAxis
              dataKey="elapsedSeconds"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => Number(value).toFixed(1)}
              tick={{ fontSize: 10, fill: '#7a8582' }}
              label={{ value: 'Elapsed time (s)', position: 'insideBottom', offset: -8, fontSize: 10, fill: '#7a8582' }}
            />
            <YAxis
              width={58}
              tick={{ fontSize: 10, fill: '#7a8582' }}
              tickFormatter={(value) => Number(value).toFixed(unit === 'mV' ? 2 : 0)}
              label={{ value: unit, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#7a8582' }}
            />
            <Tooltip
              labelFormatter={(value) => `${Number(value).toFixed(3)} s elapsed`}
              formatter={(value: number, name: string) => [`${Number(value).toFixed(unit === 'mV' ? 4 : 1)} ${unit}`, name]}
              contentStyle={{ background: '#101615', border: '1px solid #28312f', borderRadius: 10, color: '#f1f7f5', fontSize: 11 }}
            />
            {traces.map((trace) => (
              <Line
                key={String(trace.key)}
                type={trace.type || 'linear'}
                dataKey={trace.key}
                name={trace.name}
                stroke={trace.color}
                strokeWidth={trace.key === 'ecgCh2Mv' ? 1.8 : 1.25}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            <Brush dataKey="elapsedSeconds" height={22} stroke="#1B7A6E" travellerWidth={7} tickFormatter={() => ''} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {footer && <div className="border-t border-black/8 px-5 py-3 text-[10px] text-black/45 dark:border-white/8 dark:text-white/45">{footer}</div>}
    </section>
  );
}

export default function TelemetryDashboard({ deviceId, ownerName }: Props) {
  const { data, sessions, selectedSessionId, setSelectedSessionId, connectionStatus, refresh } = useTelemetryStream(deviceId);
  const selectedSession = sessions.find((session) => session.sessionId === selectedSessionId);
  const latest = data.at(-1);
  const completeness = selectedSession ? selectedSession.sampleCount / EXPECTED_V1_SAMPLE_COUNT : 0;
  const ch1Rms = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.sqrt(data.reduce((sum, point) => sum + point.ecgCh1Count ** 2, 0) / data.length);
  }, [data]);

  useEffect(() => {
    document.title = `ECG Telemetry · ${deviceId}`;
  }, [deviceId]);

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7f6] dark:bg-[#070a0a]">
      <div className="mx-auto max-w-6xl space-y-5 px-5 py-6 md:px-8 md:py-8">
        <header className="flex flex-col gap-4 border-b border-black/10 pb-5 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1B7A6E] dark:text-[#55c8b7]">Stored recording</p>
            <h1 className="truncate font-mono text-xl font-semibold">{deviceId}</h1>
            <p className="mt-1 text-xs text-black/45 dark:text-white/45">{ownerName || 'No owner assigned'} · V1 Li-Po board</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SessionPicker sessions={sessions} selectedId={selectedSessionId} onSelect={setSelectedSessionId} />
            <button onClick={refresh} className="rounded-lg border border-black/10 bg-white p-2.5 text-black/50 hover:text-[#1B7A6E] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/50" title="Refresh recordings">
              <RefreshCw size={14} />
            </button>
          </div>
        </header>

        {selectedSession && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-900 dark:text-amber-200">
            <strong>Estimated capture time:</strong> {new Date(selectedSession.startTime).toLocaleString()}–{new Date(selectedSession.endTime).toLocaleTimeString()}.
            The board sends uptime; the server aligns this recording to its upload receipt. The charts use elapsed time for accuracy.
          </div>
        )}

        {selectedSession && (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Samples" value={selectedSession.sampleCount.toLocaleString()} note={`${Math.min(100, completeness * 100).toFixed(1)}% of expected V1 batch`} />
            <Metric label="Recording length" value={formatRecordingDuration(selectedSession.durationMs)} note="Includes the final sample interval" />
            <Metric label="Measured rate" value={selectedSession.sampleRateHz ? `${selectedSession.sampleRateHz.toFixed(2)} Hz` : '—'} note="Expected 250 Hz" />
            <Metric label="Latest ECG" value={latest ? `${latest.ecgCh2Mv.toFixed(4)} mV` : '—'} note="CH2 converted from raw code" />
            <Metric label="Motion deviation" value={latest ? `${latest.dynamicMotionMg.toFixed(0)} mg` : '—'} note="Absolute deviation from 1 g" />
          </section>
        )}

        {connectionStatus === 'LOADING' && (
          <div className="flex h-64 items-center justify-center gap-3 text-sm text-black/45 dark:text-white/45">
            <RefreshCw size={17} className="animate-spin" /> Loading recording…
          </div>
        )}
        {connectionStatus === 'ERROR' && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-6 text-center text-sm text-rose-700 dark:text-rose-300">The recording could not be loaded.</div>
        )}
        {connectionStatus === 'LOADED' && data.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center text-center text-sm text-black/45 dark:text-white/45">
            <Database size={28} className="mb-3 opacity-40" />
            No telemetry recording is available for this board.
          </div>
        )}

        {data.length > 0 && (
          <>
            <TraceChart
              title="ECG — RA / LA differential"
              subtitle="Primary electrode channel (ADS1292R Channel 2)"
              data={data}
              traces={[{ key: 'ecgCh2Mv', name: 'ECG CH2', color: '#22a98f' }]}
              unit="mV"
              footer={<>Stored codes remain unchanged. Display conversion uses {ECG_CH2_MV_PER_COUNT.toExponential(6)} mV/count from the current 2.42 V reference and gain-6 configuration.</>}
            />

            <TraceChart
              title="Motion axes"
              subtitle="LIS3DH ±2 g high-resolution output; refreshed at 50 Hz and repeated in the 250 Hz ECG rows"
              data={data}
              traces={[
                { key: 'accelXMg', name: 'X', color: '#1B7A6E', type: 'stepAfter' },
                { key: 'accelYMg', name: 'Y', color: '#d59a38', type: 'stepAfter' },
                { key: 'accelZMg', name: 'Z', color: '#c45a52', type: 'stepAfter' },
              ]}
              unit="mg"
            />

            <TraceChart
              title="Motion magnitude"
              subtitle="Gravity-aware context for identifying motion-corrupted ECG regions"
              data={data}
              traces={[
                { key: 'magnitudeMg', name: 'Magnitude', color: '#6574cd', type: 'stepAfter' },
                { key: 'dynamicMotionMg', name: '|magnitude − 1000|', color: '#c45a52', type: 'stepAfter' },
              ]}
              unit="mg"
              footer="This is descriptive motion context. No motion or clinical alarm threshold is applied."
            />

            <details className="rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={15} className="text-[#1B7A6E]" /> AFE noise / offset reference</span>
                  <span className="mt-1 block text-xs text-black/45 dark:text-white/45">ADS1292R Channel 1 is internally shorted; it is not a patient ECG lead.</span>
                </span>
                <span className="font-mono text-xs text-black/45 dark:text-white/45">RMS {ch1Rms.toFixed(1)} counts</span>
              </summary>
              <div className="border-t border-black/8 p-4 dark:border-white/8">
                <TraceChart
                  title="Channel 1 diagnostic codes"
                  subtitle="Raw signed ADC counts from the internal-short reference"
                  data={data}
                  traces={[{ key: 'ecgCh1Count', name: 'CH1 reference', color: '#8b9693' }]}
                  unit="counts"
                />
              </div>
            </details>
          </>
        )}

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-4 text-[10px] text-black/40 dark:text-white/40">
          <span className="flex items-center gap-1.5"><Activity size={11} /> ECG 250 SPS nominal</span>
          <span className="flex items-center gap-1.5"><Clock3 size={11} /> Motion 50 Hz</span>
          <span className="flex items-center gap-1.5"><Database size={11} /> SD-first batch upload</span>
        </footer>
      </div>
    </div>
  );
}
