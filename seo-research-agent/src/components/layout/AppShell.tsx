"use client";

import { Command as CommandIcon, FolderKanban, History, Lightbulb, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings, Sparkles, X } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import type { AppView } from "@/lib/app-views";
import type { Command } from "@/lib/commands";
import { toggleTheme } from "@/lib/theme";

import { CommandPalette, useCommandPaletteShortcut } from "./CommandPalette";

import { ThemeToggle } from "./ThemeToggle";

export type { AppView } from "@/lib/app-views";

const NAV_ITEMS: ReadonlyArray<{ view: AppView; label: string; icon: typeof Search }> = [
  { view: "research", label: "Research", icon: Search },
  { view: "ideas", label: "Daily niches", icon: Lightbulb },
  { view: "history", label: "History", icon: History },
  { view: "projects", label: "Projects", icon: FolderKanban },
  { view: "settings", label: "Settings", icon: Settings },
];

type AppShellProps = {
  view: AppView;
  onNavigate: (view: AppView) => void;
  user: { name: string };
  demo: boolean;
  onSignOut: () => void;
  /** Extra sidebar content under the navigation (project picker, recent searches). */
  sidebar: ReactNode;
  /** Screen-specific actions for the Ctrl/Cmd+K palette. */
  commands?: readonly Command[];
  children: ReactNode;
};

/**
 * Sidebar layout on desktop, collapsible to an icon rail (automatic on
 * medium screens); the same sidebar slides in as a drawer on small screens.
 */
export function AppShell({ view, onNavigate, user, demo, onSignOut, sidebar, commands = [], children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => {
    setDrawerOpen(false);
    setPaletteOpen(true);
  }, []);
  useCommandPaletteShortcut(openPalette);
  const allCommands: Command[] = [
    ...commands,
    { id: "theme", label: "Switch light / dark theme", group: "Settings", keywords: "dark light mode appearance", run: toggleTheme },
  ];
  const drawerRef = useDialogFocus<HTMLDivElement>(drawerOpen, () => setDrawerOpen(false));
  const { collapsed, toggle } = useSidebarCollapsed();

  const navigate = (next: AppView) => {
    onNavigate(next);
    setDrawerOpen(false);
  };

  const shared = { view, onNavigate: navigate, user, demo, onSignOut, onOpenPalette: openPalette };
  const extra = (
    // Selecting a recent search on mobile should also close the drawer.
    <div onClickCapture={(event) => { if ((event.target as HTMLElement).closest("button")) setDrawerOpen(false); }}>
      {sidebar}
    </div>
  );

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 hidden border-r border-slate-200 bg-white transition-[width] duration-200 lg:block ${collapsed ? "w-16" : "w-64"}`}
      >
        {drawerOpen ? null : (
          <SidebarContent {...shared} collapsed={collapsed} onToggleCollapse={toggle}>{extra}</SidebarContent>
        )}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Brand />
        {demo ? <DemoBadge /> : <span className="w-9" />}
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="relative h-full w-72 max-w-[85vw] bg-white shadow-xl"
          >
            <SidebarContent {...shared} collapsed={false} onClose={() => setDrawerOpen(false)}>{extra}</SidebarContent>
          </div>
        </div>
      ) : null}

      <main className={`px-4 py-6 transition-[margin] duration-200 sm:px-8 lg:py-8 ${collapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>

      {paletteOpen ? <CommandPalette commands={allCommands} onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}

function SidebarContent({ view, onNavigate, user, demo, onSignOut, onOpenPalette, collapsed, onToggleCollapse, onClose, children }: {
  view: AppView;
  onNavigate: (view: AppView) => void;
  user: { name: string };
  demo: boolean;
  onSignOut: () => void;
  onOpenPalette: () => void;
  /** Icon rail: labels hidden (kept as accessible names), extra content hidden. */
  collapsed: boolean;
  /** Present on the desktop sidebar. */
  onToggleCollapse?: () => void;
  /** Present when shown as the mobile drawer. */
  onClose?: () => void;
  children: ReactNode;
}) {
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleButton = onToggleCollapse ? (
    <button type="button" onClick={onToggleCollapse} title={toggleLabel} aria-label={toggleLabel} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
      <ToggleIcon className="h-4 w-4" aria-hidden="true" />
    </button>
  ) : null;

  return (
    <div className="flex h-full flex-col">
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <BrandMark />
          {toggleButton}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <Brand />
          <div className="flex items-center gap-1">
            {demo ? <DemoBadge /> : null}
            {toggleButton}
            {onClose ? (
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close menu">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className={`mb-2 ${collapsed ? "px-2" : "px-3"}`}>
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label={collapsed ? "Quick actions" : undefined}
          aria-keyshortcuts="Control+K Meta+K"
          title="Quick actions (Ctrl+K)"
          className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 py-1.5 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-900 ${collapsed ? "justify-center px-0" : "px-3"}`}
        >
          <CommandIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {collapsed ? null : (
            <>
              <span className="flex-1 text-left">Quick actions</span>
              <kbd aria-hidden="true" className="rounded border border-slate-200 px-1.5 text-[10px] font-medium text-slate-500">Ctrl K</kbd>
            </>
          )}
        </button>
      </div>

      <nav aria-label="Main" className={`space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
        {NAV_ITEMS.map(({ view: item, label, icon: Icon }) => {
          const active = item === view;
          return (
            <button
              key={item}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              onClick={() => onNavigate(item)}
              className={`flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium transition ${collapsed ? "justify-center px-0" : "px-3"} ${
                active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {collapsed ? null : label}
            </button>
          );
        })}
      </nav>

      {collapsed ? <div className="flex-1" /> : <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">{children}</div>}

      <div className={`flex items-center border-t border-slate-100 py-4 ${collapsed ? "flex-col gap-2 px-2" : "gap-3 px-4"}`}>
        <span
          title={collapsed ? user.name : undefined}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
          aria-hidden="true"
        >
          {initials(user.name)}
        </span>
        {collapsed ? null : <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{user.name}</span>}
        <ThemeToggle />
        <button type="button" onClick={onSignOut} title="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Sign out">
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-500 text-on-accent shadow-sm">
      <Sparkles className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function Brand() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-slate-950">
      <BrandMark />
      SEO Research
    </span>
  );
}

function DemoBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800" title="Sample data from the built-in demo providers">
      Demo data
    </span>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}
