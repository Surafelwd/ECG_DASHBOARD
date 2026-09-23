import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface TableStat {
  count: number;
  latest: string | null;
}

interface DbStatus {
  public: {
    devices: TableStat;
    readings: TableStat;
    telemetry_sessions: TableStat;
    events: TableStat;
    network_location: TableStat;
  };
  ecg_ml: {
    upload_packets: TableStat;
    analysis_jobs: TableStat;
    analysis_results: TableStat;
  };
  checkedAt: string;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

interface RowProps {
  schema: string;
  table: string;
  stat: TableStat;
  accentColor: string;
}

function TableRow({ schema, table, stat, accentColor }: RowProps) {
  const hasData = stat.count > 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-[#1a1a1a] last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {hasData
          ? <CheckCircle size={13} className="text-[#1B7A6E] shrink-0" />
          : <AlertCircle size={13} className="text-[#9A9A9A] shrink-0" />
        }
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A]">{schema}.</span>
          <span className="text-xs font-bold text-light-text dark:text-[#F2F2F2]">{table}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0 ml-4">
        {stat.latest && (
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-light-text-secondary dark:text-[#9A9A9A]">
            <Clock size={9} />
            {timeAgo(stat.latest)}
          </span>
        )}
        <span
          className={`text-xs font-bold font-mono px-2 py-0.5 rounded-sm ${
            hasData
              ? 'bg-[#1B7A6E]/10 text-[#1B7A6E]'
              : 'bg-gray-100 dark:bg-[#1a1a1a] text-light-text-secondary dark:text-[#9A9A9A]'
          }`}
        >
          {stat.count.toLocaleString()} {stat.count === 1 ? 'row' : 'rows'}
        </span>
      </div>
    </div>
  );
}

export default function DbStatusPanel() {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/db-status');
      if (!res.ok) throw new Error('Failed');
      setStatus(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  return (
    <div className="bg-light-card dark:bg-[#121212] border border-gray-200 dark:border-[#262626] rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-[#1B7A6E]" />
          <h2 className="text-xs font-bold uppercase tracking-widest">Database Status</h2>
          {status && (
            <span className="text-[9px] text-light-text-secondary dark:text-[#9A9A9A] uppercase tracking-widest">
              · checked {timeAgo(status.checkedAt)}
            </span>
          )}
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 border border-gray-200 dark:border-[#333] rounded-sm text-[9px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-[#9A9A9A] hover:text-[#1B7A6E] hover:border-[#1B7A6E] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && !status && (
        <div className="flex items-center justify-center py-8 gap-3 text-light-text-secondary dark:text-[#9A9A9A]">
          <div className="w-5 h-5 border-2 border-[#1B7A6E]/30 border-t-[#1B7A6E] rounded-full animate-spin" />
          <span className="text-xs">Querying database…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-8 gap-2 text-[#C4453D]">
          <AlertCircle size={16} />
          <span className="text-xs font-bold">Failed to fetch database status</span>
        </div>
      )}

      {status && (
        <div className="divide-y divide-gray-100 dark:divide-[#1a1a1a]">
          {/* public schema */}
          <div>
            <div className="px-4 py-1.5 bg-gray-50 dark:bg-[#0a0a0a]">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#1B7A6E]">public schema</span>
            </div>
            <div className="px-4">
              <TableRow schema="public" table="devices"            stat={status.public.devices}            accentColor="#1B7A6E" />
              <TableRow schema="public" table="readings"           stat={status.public.readings}           accentColor="#1B7A6E" />
              <TableRow schema="public" table="telemetry_sessions" stat={status.public.telemetry_sessions} accentColor="#1B7A6E" />
              <TableRow schema="public" table="events"             stat={status.public.events}             accentColor="#D99B3F" />
              <TableRow schema="public" table="network_location"   stat={status.public.network_location}   accentColor="#6366f1" />
            </div>
          </div>

          {/* ecg_ml schema */}
          <div>
            <div className="px-4 py-1.5 bg-gray-50 dark:bg-[#0a0a0a]">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#6366f1]">ecg_ml schema</span>
            </div>
            <div className="px-4">
              <TableRow schema="ecg_ml" table="upload_packets"   stat={status.ecg_ml.upload_packets}   accentColor="#6366f1" />
              <TableRow schema="ecg_ml" table="analysis_jobs"    stat={status.ecg_ml.analysis_jobs}    accentColor="#6366f1" />
              <TableRow schema="ecg_ml" table="analysis_results" stat={status.ecg_ml.analysis_results} accentColor="#6366f1" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
