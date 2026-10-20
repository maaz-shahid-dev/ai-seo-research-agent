'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Cpu, 
  Lock, 
  Terminal, 
  Activity, 
  Users, 
  FolderKanban,
  Search,
  RefreshCw
} from 'lucide-react';

interface SettingsAdminViewProps {
  projectsCount: number;
  researchRunsCount: number;
}

export const SettingsAdminView: React.FC<SettingsAdminViewProps> = ({
  projectsCount,
  researchRunsCount,
}) => {
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [searchLog, setSearchLog] = useState<string>('');
  const [isPinging, setIsPinging] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialLogs = [
    { time: '08:44:20 UTC', level: 'INFO', msg: 'UI Scaffold initialized. Next.js 16 App Router loaded.' },
    { time: '08:44:22 UTC', level: 'INFO', msg: 'Loaded mock demo dataset for seed "best ai tools for productivity".' },
    { time: '08:44:25 UTC', level: 'AUDIT', msg: 'Demo configuration loaded with no external provider connection.' },
    { time: '08:44:30 UTC', level: 'INFO', msg: 'SERP competitor mock engine ready with 10 ranking targets.' },
    { time: '08:45:00 UTC', level: 'WARN', msg: 'Live external providers offline (Expected in Milestone 1 UI scaffold).' },
    { time: '08:46:12 UTC', level: 'INFO', msg: 'Country comparison matrix populated across 8 target markets.' },
    { time: '08:47:05 UTC', level: 'AUDIT', msg: 'User role context initialized to Administrator (Local demo).' },
  ];

  const handlePing = () => {
    setIsPinging(true);
    setPingSuccess(false);
    checkTimerRef.current = setTimeout(() => {
      setIsPinging(false);
      setPingSuccess(true);
      resetTimerRef.current = setTimeout(() => setPingSuccess(false), 3000);
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const filteredLogs = initialLogs.filter((l) => {
    if (logFilter !== 'ALL' && l.level !== logFilter) return false;
    if (searchLog.trim() && !l.msg.toLowerCase().includes(searchLog.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Settings &amp; Admin Operations</h1>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
              PRD FR-08 Admin Dashboard
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Operational View
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Demo-only configuration and diagnostics. No backend health endpoint or live provider is connected.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePing}
          disabled={isPinging}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? 'animate-spin' : ''}`} />
          <span>{pingSuccess ? 'Client UI responded' : 'Run client UI check'}</span>
        </button>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Authorized Users</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">2</div>
          <div className="mt-1 text-[11px] text-slate-400">Demo identities, not authenticated users</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Active Projects</span>
            <FolderKanban className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{projectsCount}</div>
          <div className="mt-1 text-[11px] text-slate-400">Session and bundled demo projects</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Research Runs Run</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{researchRunsCount}</div>
          <div className="mt-1 text-[11px] text-slate-400">Metadata rows bundled with the demo</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Est. AI Token Cost</span>
            <Cpu className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">$0.00</div>
          <div className="mt-1 text-[11px] text-slate-400">Mock engine (Zero spend)</div>
        </div>
      </div>

      {/* Provider Configuration Status (Without exposing secrets - PRD FR-08 & Sec 12) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Backend Provider Connections</h3>
            <p className="text-xs text-slate-500">
              PRD Security Rule: API secrets must never be exposed to the client or browser logs.
            </p>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
            <Lock className="h-3.5 w-3.5" /> No providers configured
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* SEO Data Provider */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-800">SEO Data Adapter</span>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                Milestone 3 Target
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Provider: <strong>Mock In-Memory Adapter</strong>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Config status: No external provider connected.
            </div>
          </div>

          {/* AI LLM Service */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-800">AI Analysis Service</span>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                Milestone 5 Target
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Engine: <strong>Mock Evaluation Model</strong>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Config status: Standby. Evidence-grounded prompts ready.
            </div>
          </div>

          {/* Database & Migrations */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-800">PostgreSQL Database</span>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                Milestone 6 Target
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Storage: <strong>Client Local State</strong>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Config status: Schema matches PRD section 10.
            </div>
          </div>
        </div>
      </div>

      {/* Operational Logs Stream with Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Simulated Operational Log Stream</h3>
          </div>

          {/* Log Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Search log messages..."
                className="w-full rounded-md border border-slate-200 bg-slate-50 pl-7 pr-2.5 py-1 text-[11px] text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-semibold">
              {['ALL', 'INFO', 'WARN', 'AUDIT'].map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setLogFilter(lvl)}
                  aria-pressed={logFilter === lvl}
                  className={`rounded px-2 py-0.5 transition ${
                    logFilter === lvl ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-slate-900 p-4 font-mono text-[11px] text-slate-200 space-y-1.5 max-h-60 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="py-4 text-center text-slate-500 text-xs">
              No log events matched query &quot;{searchLog}&quot;.
            </div>
          ) : (
            filteredLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">[{log.time}]</span>
                <span className={`shrink-0 font-bold ${
                  log.level === 'WARN' ? 'text-amber-400' : log.level === 'AUDIT' ? 'text-emerald-400' : 'text-cyan-400'
                }`}>
                  {log.level}
                </span>
                <span className="text-slate-300">{log.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
