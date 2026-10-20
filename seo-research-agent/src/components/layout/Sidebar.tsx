'use client';

import React, { useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Layers3,
  LineChart, 
  Sparkles,
  Globe2,
  FolderKanban, 
  FileSpreadsheet, 
  ShieldCheck, 
  Info,
  Database,
  Cpu,
  X,
  UserCheck
} from 'lucide-react';
import { ViewTab, Project, UserRole } from '@/types/seo';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface SidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  activeProject: Project;
  projects: Project[];
  onSelectProject: (proj: Project) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  currentRole: UserRole;
  onOpenAuthModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeProject,
  projects,
  onSelectProject,
  isOpenMobile,
  onCloseMobile,
  currentRole,
  onOpenAuthModal,
}) => {
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useDialogFocus<HTMLElement>(isOpenMobile, onCloseMobile, mobileCloseRef);
  const navItems: { id: ViewTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'keywords', label: 'Keyword Research', icon: Search, badge: 'Core' },
    { id: 'coverage', label: 'Content Coverage', icon: Layers3, badge: 'Derived' },
    { id: 'serp', label: 'SERP Analysis', icon: LineChart, badge: '10' },
    { id: 'ai_studio', label: 'AI Evidence Studio', icon: Sparkles, badge: 'FR-05' },
    { id: 'market_comparison', label: 'Market Intelligence', icon: Globe2, badge: 'FR-03' },
    { id: 'projects', label: 'Projects & Runs', icon: FolderKanban, badge: `${projects.length}` },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet, badge: 'CSV' },
    { id: 'admin', label: 'Settings & Admin', icon: ShieldCheck },
  ];

  const visibleNavItems = navItems.filter((item) => item.id !== 'admin' || currentRole === 'admin');

  useEffect(() => {
    if (currentRole === 'researcher' && currentTab === 'admin') {
      onSelectTab('overview');
    }
  }, [currentRole, currentTab, onSelectTab]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          tabIndex={-1}
        />
      )}

      {/* Sidebar Container */}
      <aside
        ref={sidebarRef}
        id="primary-sidebar"
        aria-label="Application navigation"
        role={isOpenMobile ? 'dialog' : undefined}
        aria-modal={isOpenMobile ? true : undefined}
        tabIndex={-1}
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 max-w-[calc(100vw-2rem)] flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile
            ? 'visible translate-x-0 shadow-2xl'
            : 'invisible -translate-x-full lg:visible lg:translate-x-0'
        }`}
      >
        {/* Header / Logo */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900">AI SEO Agent</span>
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                DEMO
              </span>
              <p className="text-[11px] font-medium text-slate-500">Evidence-Based Research</p>
            </div>
          </div>
          <button
            ref={mobileCloseRef}
            type="button"
            onClick={onCloseMobile}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Project Switcher */}
        <div className="border-b border-slate-100 p-4">
          <label htmlFor="project-switcher" className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Active Project
          </label>
          <div className="mt-1.5">
            <select
              id="project-switcher"
              value={activeProject.id}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} ({proj.target_country})
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Market: {activeProject.target_country} / {activeProject.target_language}</span>
            <span className="font-medium text-indigo-600">{activeProject.keyword_count ?? 0} keywords</span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Primary navigation">
          <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Navigation
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 transition ${
                      isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isActive
                        ? 'bg-indigo-200/70 text-indigo-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Role & User Bar */}
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="flex min-h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            title="Click to switch role (Admin vs Researcher demo)"
            aria-label={`Current role: ${currentRole}. Open role switcher`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
                <UserCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-xs font-bold capitalize text-slate-900">
                  {currentRole === 'admin' ? 'Demo Admin' : 'Demo Researcher'}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  Role: {currentRole} (Click to switch)
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
              Switch
            </span>
          </button>
        </div>

        {/* System & Demo Operational Status Box */}
        <div className="border-t border-slate-100 bg-slate-50/70 p-3.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-amber-600" />
              Environment Status
            </span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
              Milestone 1 UI
            </span>
          </div>

          <div className="mt-2 space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-1.5">
                <Database className="h-3 w-3 text-slate-400" /> SEO Provider:
              </span>
              <span className="font-medium text-slate-700">Demo Mock Data</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-slate-400" /> AI Engine:
              </span>
              <span className="font-medium text-slate-700">Offline / Mock</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
