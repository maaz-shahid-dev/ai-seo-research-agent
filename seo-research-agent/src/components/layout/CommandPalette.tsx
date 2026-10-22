"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useDialogFocus } from "@/hooks/useDialogFocus";
import { filterCommands, isPaletteShortcut, type Command } from "@/lib/commands";

/** Opens with Ctrl/Cmd+K anywhere in the app; the caller controls open state. */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const handle = (event: globalThis.KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      onOpen();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onOpen]);
}

/** A searchable list of actions: type to filter, arrows to move, Enter to run. */
export function CommandPalette({ commands, onClose }: { commands: readonly Command[]; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose, inputRef);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  const current = Math.min(active, Math.max(results.length - 1, 0));

  function run(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[current]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Quick actions" tabIndex={-1} className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[current] ? `${listId}-${results[current]!.id}` : undefined}
            aria-autocomplete="list"
            aria-label="Search actions"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Go to a screen, search or tab…"
            className="w-full bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none"
          />
        </div>
        <ul id={listId} role="listbox" aria-label="Actions" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? <li role="presentation" className="px-3 py-6 text-center text-sm text-slate-500">No matching actions.</li> : null}
          {results.map((command, index) => {
            const heading = command.group !== results[index - 1]?.group ? command.group : null;
            return (
              <li key={command.id} role="presentation">
                {heading ? <p role="presentation" className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{heading}</p> : null}
                <div
                  id={`${listId}-${command.id}`}
                  role="option"
                  aria-selected={index === current}
                  onMouseMove={() => setActive(index)}
                  onClick={() => run(command)}
                  className={`cursor-pointer truncate rounded-lg px-3 py-2 text-sm ${index === current ? "bg-indigo-50 text-indigo-700" : "text-slate-700"}`}
                >
                  {command.label}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}
