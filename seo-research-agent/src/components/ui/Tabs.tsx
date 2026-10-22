"use client";

import { useRef, type KeyboardEvent } from "react";

export type TabItem<T extends string> = { id: T; label: string; count?: number };

type TabsProps<T extends string> = {
  label: string;
  tabs: readonly TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
};

/** WAI-ARIA tabs: arrow keys move between tabs. Pair with `tabPanelProps`. */
export function Tabs<T extends string>({ label, tabs, selected, onSelect }: TabsProps<T>) {
  const prefix = tabsPrefix(label);
  const buttons = useRef(new Map<T, HTMLButtonElement>());

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    // Move from the focused tab (it may differ from the selected one).
    const focused = tabs.findIndex((tab) => buttons.current.get(tab.id) === event.target);
    const index = focused >= 0 ? focused : tabs.findIndex((tab) => tab.id === selected);
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]!;
    onSelect(next.id);
    buttons.current.get(next.id)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={handleKeyDown} className="relative flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = tab.id === selected;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) buttons.current.set(tab.id, element);
              else buttons.current.delete(tab.id);
            }}
            id={`${prefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${prefix}-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? <> <span className={`ml-1 text-xs ${active ? "text-indigo-100" : "text-slate-400"}`}>{tab.count}</span></> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Props for the panel matching the selected tab. */
export function tabPanelProps(label: string, id: string) {
  const prefix = tabsPrefix(label);
  return { role: "tabpanel", id: `${prefix}-panel-${id}`, "aria-labelledby": `${prefix}-tab-${id}` } as const;
}

function tabsPrefix(label: string) {
  return `tabs-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
