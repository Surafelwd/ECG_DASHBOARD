import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database, RefreshCw, Radio, Cpu, Layers,
  Search, ArrowLeft, Copy, Check, ChevronLeft, ChevronRight, ChevronsLeft,
  ChevronsRight, AlertCircle, X
} from 'lucide-react';

export interface DeviceDatabaseTablesProps {
  devices: any[];
  selectedDeviceId?: string;
  onSelectDevice?: (deviceId: string) => void;
  onClose?: () => void;
}

type MainTab = 'public' | 'network' | 'ecg_ml';
type PublicSubTab = 'sessions' | 'readings' | 'events';
type MlSubTab = 'analysis_results' | 'motion_results' | 'analysis_jobs' | 'upload_packets';

export default function DeviceDatabaseTables({
  devices,
  selectedDeviceId: initialDeviceId,
  onSelectDevice,
  onClose,
}: DeviceDatabaseTablesProps) {
  const [currentDeviceId, setCurrentDeviceId] = useState<string>(
    initialDeviceId || devices[0]?.id || 'DEV-0198'
  );
  const [mainTab, setMainTab] = useState<MainTab>('public');
  const [publicSubTab, setPublicSubTab] = useState<PublicSubTab>('sessions');
  const [mlSubTab, setMlSubTab] = useState<MlSubTab>('analysis_results');

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [tableRows, setTableRows] = useState<any[]>([]);

  // Overview data & overall counts
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedJsonRow, setSelectedJsonRow] = useState<any | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (initialDeviceId && initialDeviceId !== currentDeviceId) {
      setCurrentDeviceId(initialDeviceId);
    }
  }, [initialDeviceId]);

  // Determine current active table key for the API
  const activeTableKey = useMemo(() => {
    if (mainTab === 'public') return publicSubTab;
    if (mainTab === 'network') return 'network_location';
    return mlSubTab;
  }, [mainTab, publicSubTab, mlSubTab]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Fetch full overview counts
  const fetchOverview = useCallback(async (devId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/device-db-tables/${encodeURIComponent(devId)}?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setOverviewData(json);
    } catch (err: any) {
      console.error('Failed to fetch DB overview:', err);
      setError(err.message || 'Database connection error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch paginated rows for the active table
  const fetchActiveTable = useCallback(async (devId: string, tableKey: string, page: number, limit: number) => {
    setIsTableLoading(true);
    try {
      const res = await fetch(
        `/api/device-db-tables/${encodeURIComponent(devId)}?table=${encodeURIComponent(tableKey)}&page=${page}&limit=${limit}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTableRows(json.rows || []);
      setTotalCount(json.totalCount || 0);
      setTotalPages(json.totalPages || 1);
      setCurrentPage(json.page || 1);
    } catch (err: any) {
      console.error(`Failed to fetch table ${tableKey}:`, err);
    } finally {
      setIsTableLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentDeviceId) {
      fetchOverview(currentDeviceId);
    }
  }, [currentDeviceId, fetchOverview]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTableKey, pageSize, currentDeviceId]);

  useEffect(() => {
    if (currentDeviceId && activeTableKey) {
      fetchActiveTable(currentDeviceId, activeTableKey, currentPage, pageSize);
    }
  }, [currentDeviceId, activeTableKey, currentPage, pageSize, fetchActiveTable]);

  const handleDeviceChange = (devId: string) => {
    setCurrentDeviceId(devId);
    if (onSelectDevice) onSelectDevice(devId);
  };

  const handleRefresh = () => {
    fetchOverview(currentDeviceId);
    fetchActiveTable(currentDeviceId, activeTableKey, currentPage, pageSize);
  };

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return tableRows;
    const term = searchTerm.toLowerCase();
    return tableRows.filter(row =>
      Object.values(row).some(val =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(term)
      )
    );
  }, [tableRows, searchTerm]);

  const formatTimestamp = (ts: any) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
    } catch {
      return String(ts);
    }
  };

  const counts = overviewData?.counts || {
    sessions: 0,
    readings: 0,
    events: 0,
    networkLocation: 0,
    uploadPackets: 0,
    analysisJobs: 0,
    analysisResults: 0,
    motionResults: 0,
  };

  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="h-full w-full flex flex-col bg-[#0d0d0d] text-gray-200 overflow-hidden font-sans select-none">
      {/* ── TOP NAVIGATION BAR ───────────────────────────────────────────── */}
      <div className="flex-none px-4 py-3 border-b border-[#222] bg-[#121212] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to Device</span>
            </button>
          )}

          <div className="h-5 w-px bg-[#262626]" />

          <div className="flex items-center gap-2">
            <Database size={16} className="text-[#1B7A6E]" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Database Explorer</span>
          </div>

          {/* Device Selector */}
          <div className="flex items-center gap-2 bg-[#181818] border border-[#333] rounded px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Device:</span>
            <select
              value={currentDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-[#1B7A6E] outline-none cursor-pointer"
            >
              {devices && devices.length > 0 ? (
                devices.map(d => (
                  <option key={d.id} value={d.id} className="bg-[#181818] text-gray-200">
                    {d.id} {d.ownerName ? `(${d.ownerName})` : ''}
                  </option>
                ))
              ) : (
                <option value={currentDeviceId}>{currentDeviceId}</option>
              )}
            </select>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2.5">
          {/* Search */}
          <div className="flex items-center gap-2 bg-[#181818] border border-[#333] rounded px-2.5 py-1 text-xs w-60">
            <Search size={13} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search in table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-white w-full placeholder-gray-500 font-mono text-[11px]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-white">✕</button>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isLoading || isTableLoading}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#1B7A6E]/15 hover:bg-[#1B7A6E]/25 text-[#1B7A6E] border border-[#1B7A6E]/30 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw size={13} className={isLoading || isTableLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── SCHEMA & TABLE SELECTION TABS ────────────────────────────────── */}
      <div className="flex-none px-4 py-2 bg-[#141414] border-b border-[#222] flex flex-wrap items-center justify-between gap-3">
        {/* Main Schema Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMainTab('public')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
              mainTab === 'public'
                ? 'bg-[#1B7A6E] text-white shadow-sm'
                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
            }`}
          >
            <Layers size={13} />
            <span>Public</span>
            <span className="ml-1 text-[10px] font-mono px-1 rounded bg-black/40 text-gray-200">
              {(counts.sessions + counts.readings + counts.events).toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setMainTab('network')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
              mainTab === 'network'
                ? 'bg-[#1B7A6E] text-white shadow-sm'
                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
            }`}
          >
            <Radio size={13} />
            <span>Network Location</span>
            <span className="ml-1 text-[10px] font-mono px-1 rounded bg-black/40 text-gray-200">
              {counts.networkLocation.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setMainTab('ecg_ml')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
              mainTab === 'ecg_ml'
                ? 'bg-[#1B7A6E] text-white shadow-sm'
                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
            }`}
          >
            <Cpu size={13} />
            <span>ECG ML</span>
            <span className="ml-1 text-[10px] font-mono px-1 rounded bg-black/40 text-gray-200">
              {(counts.uploadPackets + counts.analysisJobs + counts.analysisResults + (counts.motionResults || 0)).toLocaleString()}
            </span>
          </button>
        </div>

        {/* Sub-Table Selector */}
        <div className="flex items-center gap-1">
          {mainTab === 'public' && (
            <>
              <button
                onClick={() => setPublicSubTab('sessions')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  publicSubTab === 'sessions'
                    ? 'bg-[#262626] text-white border border-[#444]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                telemetry_sessions ({counts.sessions.toLocaleString()})
              </button>
              <button
                onClick={() => setPublicSubTab('readings')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  publicSubTab === 'readings'
                    ? 'bg-[#262626] text-white border border-[#444]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                readings ({counts.readings.toLocaleString()})
              </button>
              <button
                onClick={() => setPublicSubTab('events')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  publicSubTab === 'events'
                    ? 'bg-[#262626] text-white border border-[#444]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                events ({counts.events.toLocaleString()})
              </button>
            </>
          )}

          {mainTab === 'ecg_ml' && (
            <>
              <button
                onClick={() => setMlSubTab('analysis_results')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  mlSubTab === 'analysis_results'
                    ? 'bg-[#262626] text-white border border-[#444]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                analysis_results ({counts.analysisResults.toLocaleString()})
              </button>
              <button
                onClick={() => setMlSubTab('motion_results')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  mlSubTab === 'motion_results'
                    ? 'bg-[#262626] text-white border border-[#444]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                motion_results ({(counts.motionResults || 0).toLocaleString()})
              </button>
              <button
                onClick={() => setMlSubTab('analysis_jobs')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  mlSubTab === 'analysis_jobs'
                    ? 'bg-[#262626] text-white border border-[#444]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                analysis_jobs ({counts.analysisJobs.toLocaleString()})
              </button>
              <button
                onClick={() => setMlSubTab('upload_packets')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  mlSubTab === 'upload_packets'
                    ? 'bg-[#262626] text-white border border-[#444]'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                upload_packets ({counts.uploadPackets.toLocaleString()})
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── MAIN TABLE VIEWPORT ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-[#0a0a0a]">
        {isLoading || isTableLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
            <RefreshCw size={24} className="animate-spin text-[#1B7A6E]" />
            <span className="text-xs font-mono uppercase tracking-wider">
              Loading {activeTableKey} records ({startRecord.toLocaleString()}–{endRecord.toLocaleString()})...
            </span>
          </div>
        ) : error ? (
          <div className="p-6 m-4 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs font-mono flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 text-rose-400 mt-0.5" />
            <div>{error}</div>
          </div>
        ) : (
          <div className="min-w-full">
            {/* ── 1. PUBLIC: SESSIONS ──────────────────────────────────── */}
            {mainTab === 'public' && publicSubTab === 'sessions' && (
              <SessionsTable
                rows={filteredRows}
                formatTimestamp={formatTimestamp}
                onCopy={handleCopy}
                copiedText={copiedText}
              />
            )}

            {/* ── 2. PUBLIC: READINGS ──────────────────────────────────── */}
            {mainTab === 'public' && publicSubTab === 'readings' && (
              <ReadingsTable
                rows={filteredRows}
                formatTimestamp={formatTimestamp}
                onCopy={handleCopy}
                copiedText={copiedText}
              />
            )}

            {/* ── 3. PUBLIC: EVENTS ────────────────────────────────────── */}
            {mainTab === 'public' && publicSubTab === 'events' && (
              <EventsTable
                rows={filteredRows}
                formatTimestamp={formatTimestamp}
                onViewJson={(payload: any) => setSelectedJsonRow(payload)}
              />
            )}

            {/* ── 4. NETWORK LOCATION ──────────────────────────────────── */}
            {mainTab === 'network' && (
              <NetworkLocationTable
                rows={filteredRows}
                formatTimestamp={formatTimestamp}
              />
            )}

            {/* ── 5. ECG ML: UPLOAD PACKETS ────────────────────────────── */}
            {mainTab === 'ecg_ml' && mlSubTab === 'upload_packets' && (
              <UploadPacketsTable
                rows={filteredRows}
                formatTimestamp={formatTimestamp}
              />
            )}

            {/* ── 6. ECG ML: ANALYSIS JOBS ─────────────────────────────── */}
            {mainTab === 'ecg_ml' && mlSubTab === 'analysis_jobs' && (
              <AnalysisJobsTable
                rows={filteredRows}
                formatTimestamp={formatTimestamp}
              />
            )}

            {/* ── 7. ECG ML: ANALYSIS RESULTS ──────────────────────────── */}
            {mainTab === 'ecg_ml' && mlSubTab === 'analysis_results' && (
              <AnalysisResultsTable
                rows={filteredRows}
                formatTimestamp={formatTimestamp}
              />
            )}

            {/* ── 8. ECG ML: MOTION RESULTS (10-second uploads) ───────── */}
            {mainTab === 'ecg_ml' && mlSubTab === 'motion_results' && (
              <MotionResultsTable
                rows={filteredRows}
                formatTimestamp={formatTimestamp}
                onViewJson={(payload: any) => setSelectedJsonRow(payload)}
              />
            )}
          </div>
        )}
      </div>

      {/* ── PAGINATION BAR (100 shown, next page 1000) ────────────────── */}
      <div className="flex-none px-4 py-2.5 bg-[#121212] border-t border-[#222] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[11px]">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-0.5 text-white outline-none cursor-pointer"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1,000</option>
            </select>
          </div>

          <span className="text-gray-400 text-[11px]">
            Showing <b className="text-white">{startRecord.toLocaleString()}</b>–<b className="text-white">{endRecord.toLocaleString()}</b> of <b className="text-[#1B7A6E]">{totalCount.toLocaleString()}</b>
          </span>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage <= 1 || isTableLoading}
            className="p-1 rounded bg-[#1c1c1c] hover:bg-[#282828] border border-[#333] disabled:opacity-30 disabled:cursor-not-allowed text-gray-300"
            title="First page"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || isTableLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1c1c1c] hover:bg-[#282828] border border-[#333] disabled:opacity-30 disabled:cursor-not-allowed text-gray-300"
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          <span className="px-2.5 py-0.5 text-gray-300 font-bold">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || isTableLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1c1c1c] hover:bg-[#282828] border border-[#333] disabled:opacity-30 disabled:cursor-not-allowed text-gray-300"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage >= totalPages || isTableLoading}
            className="p-1 rounded bg-[#1c1c1c] hover:bg-[#282828] border border-[#333] disabled:opacity-30 disabled:cursor-not-allowed text-gray-300"
            title="Last page"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>

      {/* ── JSON PAYLOAD MODAL ──────────────────────────────────────────── */}
      {selectedJsonRow && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#333] rounded max-w-xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white">Event Payload</span>
              <button onClick={() => setSelectedJsonRow(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <pre className="p-3 bg-black rounded text-[11px] font-mono text-emerald-400 max-h-80 overflow-auto border border-[#222]">
              {JSON.stringify(selectedJsonRow, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedJsonRow(null)}
                className="px-3 py-1 rounded bg-[#222] hover:bg-[#333] text-xs font-bold uppercase text-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA TABLES
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ tableName }: { tableName: string }) {
  return (
    <div className="py-20 text-center text-gray-500 font-mono text-xs">
      No records in <code className="text-[#1B7A6E]">{tableName}</code>
    </div>
  );
}

function SessionsTable({ rows, formatTimestamp, onCopy, copiedText }: any) {
  if (rows.length === 0) return <EmptyState tableName="public.telemetry_sessions" />;

  return (
    <table className="w-full text-left text-[11px] font-mono border-collapse">
      <thead className="bg-[#141414] text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#222] sticky top-0 z-10">
        <tr>
          <th className="py-2.5 px-4">Session ID</th>
          <th className="py-2.5 px-4">Received At</th>
          <th className="py-2.5 px-4">Window (Start → End)</th>
          <th className="py-2.5 px-4">Sample Count</th>
          <th className="py-2.5 px-4">Uptime (ms)</th>
          <th className="py-2.5 px-4">Payload SHA256</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1a1a1a] text-gray-300">
        {rows.map((row: any) => (
          <tr key={row.id} className="hover:bg-[#121212] transition-colors">
            <td className="py-2 px-4 text-[#1B7A6E] font-bold">
              <div className="flex items-center gap-1.5">
                <span title={row.id}>{row.id?.slice(0, 8)}...</span>
                <button onClick={() => onCopy(row.id)} title="Copy UUID" className="text-gray-500 hover:text-gray-300">
                  {copiedText === row.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
            </td>
            <td className="py-2 px-4 whitespace-nowrap">{formatTimestamp(row.received_at)}</td>
            <td className="py-2 px-4 whitespace-nowrap">
              <span className="text-gray-400">{formatTimestamp(row.estimated_start_time).split(' ')[1]}</span>
              <span className="text-gray-600 mx-1">→</span>
              <span className="text-white">{formatTimestamp(row.estimated_end_time).split(' ')[1]}</span>
            </td>
            <td className="py-2 px-4 font-bold text-white">{Number(row.sample_count).toLocaleString()}</td>
            <td className="py-2 px-4 font-mono text-gray-300 text-xs">
              {row.device_uptime_end_ms ? `${Number(row.device_uptime_end_ms).toLocaleString()} ms` : '—'}
            </td>
            <td className="py-2 px-4 text-gray-400 text-[10px]" title={row.payload_hash}>
              {row.payload_hash?.slice(0, 12)}...
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReadingsTable({ rows, formatTimestamp }: any) {
  if (rows.length === 0) return <EmptyState tableName="public.readings" />;

  return (
    <table className="w-full text-left text-[11px] font-mono border-collapse">
      <thead className="bg-[#141414] text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#222] sticky top-0 z-10">
        <tr>
          <th className="py-2.5 px-4">ID</th>
          <th className="py-2.5 px-4">Time (UTC)</th>
          <th className="py-2.5 px-4">ECG Lead II</th>
          <th className="py-2.5 px-4">ECG Ch1</th>
          <th className="py-2.5 px-4">Accel (X, Y, Z)</th>
          <th className="py-2.5 px-4">Session UUID</th>
          <th className="py-2.5 px-4">Uptime (ms)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1a1a1a] text-gray-300">
        {rows.map((row: any) => (
          <tr key={row.id} className="hover:bg-[#121212] transition-colors">
            <td className="py-2 px-4 text-gray-500 font-bold">{row.id}</td>
            <td className="py-2 px-4 whitespace-nowrap text-white">{formatTimestamp(row.time)}</td>
            <td className="py-2 px-4 text-emerald-400 font-bold">
              {row.ecg_ch2 !== null ? Number(row.ecg_ch2).toFixed(2) : '—'}
            </td>
            <td className="py-2 px-4">{row.ecg_ch1 !== null ? Number(row.ecg_ch1).toFixed(2) : '—'}</td>
            <td className="py-2 px-4 text-gray-400">
              {row.accel_x ?? 0}, {row.accel_y ?? 0}, {row.accel_z ?? 0}
            </td>
            <td className="py-2 px-4 text-gray-500 text-[10px]" title={row.session_id}>
              {row.session_id?.slice(0, 8)}...
            </td>
            <td className="py-2 px-4 text-gray-400">{row.device_uptime_ms ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventsTable({ rows, formatTimestamp, onViewJson }: any) {
  if (rows.length === 0) return <EmptyState tableName="public.events" />;

  return (
    <table className="w-full text-left text-[11px] font-mono border-collapse">
      <thead className="bg-[#141414] text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#222] sticky top-0 z-10">
        <tr>
          <th className="py-2.5 px-4">ID</th>
          <th className="py-2.5 px-4">Type</th>
          <th className="py-2.5 px-4">Subtype</th>
          <th className="py-2.5 px-4">Severity</th>
          <th className="py-2.5 px-4">Status</th>
          <th className="py-2.5 px-4">Created At</th>
          <th className="py-2.5 px-4">Payload</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1a1a1a] text-gray-300">
        {rows.map((row: any) => (
          <tr key={row.id} className="hover:bg-[#121212] transition-colors">
            <td className="py-2 px-4 text-gray-500 font-bold">{row.id}</td>
            <td className="py-2 px-4 text-white font-bold">{row.event_type}</td>
            <td className="py-2 px-4 text-gray-300">{row.subtype}</td>
            <td className="py-2 px-4">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                row.severity === 'critical' ? 'bg-rose-950 text-rose-400 border border-rose-900/50' :
                row.severity === 'warning' ? 'bg-amber-950 text-amber-400 border border-amber-900/50' :
                'bg-[#1B7A6E]/20 text-[#1B7A6E] border border-[#1B7A6E]/30'
              }`}>
                {row.severity || 'info'}
              </span>
            </td>
            <td className="py-2 px-4 text-gray-400">{row.status || 'Active'}</td>
            <td className="py-2 px-4 whitespace-nowrap text-gray-400">{formatTimestamp(row.created_at)}</td>
            <td className="py-2 px-4">
              {row.payload ? (
                <button
                  onClick={() => onViewJson(row.payload)}
                  className="px-2 py-0.5 rounded bg-[#1e1e1e] hover:bg-[#282828] text-emerald-400 text-[10px] border border-[#333]"
                >
                  View JSON
                </button>
              ) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NetworkLocationTable({ rows, formatTimestamp }: any) {
  if (rows.length === 0) return <EmptyState tableName="public.network_location" />;

  return (
    <table className="w-full text-left text-[11px] font-mono border-collapse">
      <thead className="bg-[#141414] text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#222] sticky top-0 z-10">
        <tr>
          <th className="py-2.5 px-4">ID</th>
          <th className="py-2.5 px-4">MCC (Country)</th>
          <th className="py-2.5 px-4">MNC (Operator)</th>
          <th className="py-2.5 px-4">TAC (LTE LAC)</th>
          <th className="py-2.5 px-4">Cell ID</th>
          <th className="py-2.5 px-4">Session UUID</th>
          <th className="py-2.5 px-4">Recorded At</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1a1a1a] text-gray-300">
        {rows.map((row: any) => (
          <tr key={row.id} className="hover:bg-[#121212] transition-colors">
            <td className="py-2 px-4 text-gray-500 font-bold">{row.id}</td>
            <td className="py-2 px-4 text-[#D99B3F] font-bold">{row.mcc ?? '—'}</td>
            <td className="py-2 px-4 text-white">{row.mnc ?? '—'}</td>
            <td className="py-2 px-4 text-emerald-400 font-bold">{row.tac ?? '—'}</td>
            <td className="py-2 px-4 text-white font-bold">{row.cell_id ?? '—'}</td>
            <td className="py-2 px-4 text-gray-500 text-[10px]" title={row.session_id}>
              {row.session_id?.slice(0, 8)}...
            </td>
            <td className="py-2 px-4 whitespace-nowrap text-gray-400">{formatTimestamp(row.recorded_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UploadPacketsTable({ rows, formatTimestamp }: any) {
  if (rows.length === 0) return <EmptyState tableName="ecg_ml.upload_packets" />;

  return (
    <table className="w-full text-left text-[11px] font-mono border-collapse">
      <thead className="bg-[#141414] text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#222] sticky top-0 z-10">
        <tr>
          <th className="py-2.5 px-4">Upload ID</th>
          <th className="py-2.5 px-4">Start (ms)</th>
          <th className="py-2.5 px-4">End (ms)</th>
          <th className="py-2.5 px-4">Duration</th>
          <th className="py-2.5 px-4">CSV Size</th>
          <th className="py-2.5 px-4">SHA256</th>
          <th className="py-2.5 px-4">Received At</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1a1a1a] text-gray-300">
        {rows.map((row: any) => {
          const dur = (Number(row.end_ms) - Number(row.start_ms)) / 1000;
          return (
            <tr key={row.upload_id} className="hover:bg-[#121212] transition-colors">
              <td className="py-2 px-4 text-rose-400 font-bold">{row.upload_id}</td>
              <td className="py-2 px-4 text-gray-400">{Number(row.start_ms).toLocaleString()}</td>
              <td className="py-2 px-4 text-gray-400">{Number(row.end_ms).toLocaleString()}</td>
              <td className="py-2 px-4 text-white font-bold">{dur.toFixed(1)}s</td>
              <td className="py-2 px-4 text-gray-300">{row.csv_bytes ? `${Math.round(row.csv_bytes / 1024)} KB` : '—'}</td>
              <td className="py-2 px-4 text-gray-500 text-[10px]" title={row.body_sha256}>
                {row.body_sha256?.slice(0, 12)}...
              </td>
              <td className="py-2 px-4 whitespace-nowrap text-gray-400">{formatTimestamp(row.received_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AnalysisJobsTable({ rows, formatTimestamp }: any) {
  if (rows.length === 0) return <EmptyState tableName="ecg_ml.analysis_jobs" />;

  return (
    <table className="w-full text-left text-[11px] font-mono border-collapse">
      <thead className="bg-[#141414] text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#222] sticky top-0 z-10">
        <tr>
          <th className="py-2.5 px-4">Job ID</th>
          <th className="py-2.5 px-4">Status</th>
          <th className="py-2.5 px-4">Packets (1 → 2 → 3)</th>
          <th className="py-2.5 px-4">Attempts</th>
          <th className="py-2.5 px-4">Last Error</th>
          <th className="py-2.5 px-4">Updated At</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1a1a1a] text-gray-300">
        {rows.map((row: any) => (
          <tr key={row.job_id} className="hover:bg-[#121212] transition-colors">
            <td className="py-2 px-4 text-rose-400 font-bold" title={row.job_id}>
              {row.job_id?.slice(0, 8)}...
            </td>
            <td className="py-2 px-4">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                row.status === 'completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' :
                row.status === 'running' ? 'bg-blue-950 text-blue-400 border border-blue-900/50 animate-pulse' :
                row.status === 'failed' ? 'bg-rose-950 text-rose-400 border border-rose-900/50' :
                'bg-amber-950 text-amber-400 border border-amber-900/50'
              }`}>
                {row.status}
              </span>
            </td>
            <td className="py-2 px-4 text-[10px] text-gray-400">
              {row.first_upload_id} → {row.second_upload_id} → {row.third_upload_id}
            </td>
            <td className="py-2 px-4 text-white font-bold">{row.attempts}</td>
            <td className="py-2 px-4 text-rose-400 text-[10px]">{row.last_error_code || 'None'}</td>
            <td className="py-2 px-4 whitespace-nowrap text-gray-400">{formatTimestamp(row.updated_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AnalysisResultsTable({ rows, formatTimestamp }: any) {
  if (rows.length === 0) return <EmptyState tableName="ecg_ml.analysis_results" />;

  return (
    <table className="w-full text-left text-[11px] font-mono border-collapse">
      <thead className="bg-[#141414] text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#222] sticky top-0 z-10">
        <tr>
          <th className="py-2.5 px-4">Job ID</th>
          <th className="py-2.5 px-4">Classification</th>
          <th className="py-2.5 px-4">Confidence</th>
          <th className="py-2.5 px-4">Quality</th>
          <th className="py-2.5 px-4">Review</th>
          <th className="py-2.5 px-4">Model</th>
          <th className="py-2.5 px-4">Window (ms)</th>
          <th className="py-2.5 px-4">Created At</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1a1a1a] text-gray-300">
        {rows.map((row: any) => (
          <tr key={row.job_id} className="hover:bg-[#121212] transition-colors">
            <td className="py-2 px-4 text-rose-400 font-bold" title={row.job_id}>
              {row.job_id?.slice(0, 8)}...
            </td>
            <td className="py-2 px-4">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                row.label === 'normal' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' :
                row.label === 'af_suspected' ? 'bg-rose-950/80 text-rose-300 border border-rose-800' :
                row.label === 'other_rhythm' ? 'bg-amber-950/80 text-amber-300 border border-amber-800' :
                'bg-yellow-950/80 text-yellow-300 border border-yellow-800'
              }`}>
                {row.label === 'normal' ? 'Normal Sinus' :
                 row.label === 'af_suspected' ? 'AF Suspected' :
                 row.label === 'other_rhythm' ? 'Other Rhythm' :
                 'Uncertain / Review'}
              </span>
            </td>
            <td className="py-2 px-4 text-white font-bold" title="Model score from 0 to 1, not medical certainty">
              {(Number(row.confidence) * 100).toFixed(1)}%
            </td>
            <td className="py-2 px-4 capitalize text-gray-300">
              {row.quality === 'usable' ? 'Usable' : row.quality === 'poor_signal' ? 'Poor Signal' : row.quality || 'usable'}
            </td>
            <td className="py-2 px-4">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                row.requires_review ? 'bg-amber-950 text-amber-400 border border-amber-900/50' : 'bg-emerald-950 text-emerald-400'
              }`} title={row.requires_review ? 'Must not be treated as a final diagnosis' : 'Standard'}>
                {row.requires_review ? 'Review Required' : 'Standard'}
              </span>
            </td>
            <td className="py-2 px-4 text-gray-400 text-[10px]">
              v{row.model_version}
            </td>
            <td className="py-2 px-4 text-gray-400 whitespace-nowrap">
              {Number(row.input_start_ms).toLocaleString()} → {Number(row.input_end_ms).toLocaleString()}
            </td>
            <td className="py-2 px-4 whitespace-nowrap text-gray-400">{formatTimestamp(row.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MotionResultsTable({ rows, formatTimestamp, onViewJson }: any) {
  if (rows.length === 0) return <EmptyState tableName="ecg_ml.motion_results" />;

  return (
    <table className="w-full text-left text-[11px] font-mono border-collapse">
      <thead className="bg-[#141414] text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#222] sticky top-0 z-10">
        <tr>
          <th className="py-2.5 px-4">ID</th>
          <th className="py-2.5 px-4">Upload ID</th>
          <th className="py-2.5 px-4">Verdict</th>
          <th className="py-2.5 px-4">Confidence</th>
          <th className="py-2.5 px-4">Model</th>
          <th className="py-2.5 px-4">Research Only</th>
          <th className="py-2.5 px-4">Recorded At</th>
          <th className="py-2.5 px-4">Motion Data</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1a1a1a] text-gray-300">
        {rows.map((row: any) => {
          const m = row.motion_result || {};
          const verdict = m.verdict || m.activity_level || m.motion_level || '—';
          const conf = m.confidence !== undefined ? `${(Number(m.confidence) * 100).toFixed(0)}%` : '—';
          const modelVer = m.model_version || 'v1';
          const isResearchOnly = m.research_only ?? true;
          return (
            <tr key={row.id} className="hover:bg-[#121212] transition-colors">
              <td className="py-2 px-4 text-gray-500 font-bold">{row.id}</td>
              <td className="py-2 px-4 text-rose-400 font-bold" title={row.upload_id}>
                {row.upload_id?.slice(0, 10)}...
              </td>
              <td className="py-2 px-4">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#1B7A6E]/20 text-[#1B7A6E] border border-[#1B7A6E]/30">
                  {verdict === 'supine' ? 'Supine' :
                   verdict === 'upright_stationary' ? 'Upright Stationary' :
                   verdict === 'walking' ? 'Walking' : verdict}
                </span>
              </td>
              <td className="py-2 px-4 text-white font-bold">{conf}</td>
              <td className="py-2 px-4 text-gray-400">{modelVer}</td>
              <td className="py-2 px-4">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                  isResearchOnly ? 'text-amber-400 bg-amber-950/50 border border-amber-900/40' : 'text-gray-400'
                }`}>
                  {isResearchOnly ? 'Yes' : 'No'}
                </span>
              </td>
              <td className="py-2 px-4 whitespace-nowrap text-gray-400">{formatTimestamp(row.created_at)}</td>
              <td className="py-2 px-4">
                <button
                  onClick={() => onViewJson(m)}
                  className="px-2 py-0.5 rounded bg-[#1e1e1e] hover:bg-[#282828] text-emerald-400 text-[10px] border border-[#333]"
                >
                  View JSON
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
