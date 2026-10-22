"use client";

import { FolderKanban, Lightbulb, LogOut, Menu, Search, Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useDialogFocus } from "@/hooks/useDialogFocus";

export type AppView = "research" | "ideas" | "projects";

const NAV_ITEMS: ReadonlyArray<{ view: AppView; label: string; icon: typeof Search }> = [
  { view: "research", label: "Research", icon: Search },
  { view: "ideas", label: "Daily niches", icon: Lightbulb },
  { view: "projects", label: "Projects", icon: FolderKanban },
];

type AppShellProps = {
  view: AppView;
  onNavigate: (view: AppView) => void;
  user: { name: string };
  demo: boolean;
  onSignOut: () => void;
  /** Extra sidebar content under the navigation (project picker, recent searches). */
  sidebar: ReactNode;
  children: ReactNode;
};

/** Sidebar layout on desktop; the same sidebar slides in as a drawer on small screens. */
export function AppShell({ view, onNavigate, user, demo, onSignOut, sidebar, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useDialogFocus<HTMLDivElement>(drawerOpen, () => setDrawerOpen(false));

  const navigate = (next: AppView) => {
    onNavigate(next);
    setDrawerOpen(false);
  };

  const content = (
    <SidebarContent view={view} onNavigate={navigate} user={user} demo={demo} onSignOut={onSignOut}>
      {/* Selecting a recent search on mobile should also close the drawer. */}
      <div onClickCapture={(event) => { if ((event.target as HTMLElement).closest("button")) setDrawerOpen(false); }}>
        {sidebar}
      </div>
    </SidebarContent>
  );

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">{drawerOpen ? null : content}</aside>

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
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="relative h-full w-72 max-w-[85vw] bg-white shadow-xl"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {content}
          </div>
        </div>
      ) : null}

      <main className="px-4 py-6 sm:px-8 lg:ml-64 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  );
}

function SidebarContent({ view, onNavigate, user, demo, onSignOut, children }: {
  view: AppView;
  onNavigate: (view: AppView) => void;
  user: { name: string };
  demo: boolean;
  onSignOut: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Brand />
        {demo ? <DemoBadge /> : null}
      </div>

      <nav aria-label="Main" className="space-y-1 px-3">
        {NAV_ITEMS.map(({ view: item, label, icon: Icon }) => {
          const active = item === view;
          return (
            <button
              key={item}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(item)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">{children}</div>

      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700" aria-hidden="true">
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{user.name}</span>
        <button type="button" onClick={onSignOut} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Sign out">
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-slate-950">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-sm">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </span>
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
