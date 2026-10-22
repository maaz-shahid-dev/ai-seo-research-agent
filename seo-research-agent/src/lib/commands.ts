export type Command = {
  id: string;
  label: string;
  /** Heading the command is listed under, e.g. "Go to" or "Recent searches". */
  group: string;
  /** Extra words that should match, e.g. "dark light" for the theme switch. */
  keywords?: string;
  run: () => void;
};

const MAX_RESULTS = 50;

/**
 * Commands whose label, group or keywords contain every typed word, in
 * their original order; exact label prefixes come first.
 */
export function filterCommands(commands: readonly Command[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return commands.slice(0, MAX_RESULTS);
  const matches = commands.filter((command) => {
    const text = `${command.label} ${command.group} ${command.keywords ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const first = query.trim().toLowerCase();
  return [
    ...matches.filter((command) => command.label.toLowerCase().startsWith(first)),
    ...matches.filter((command) => !command.label.toLowerCase().startsWith(first)),
  ].slice(0, MAX_RESULTS);
}

/** Ctrl+K on Windows and Linux, Cmd+K on macOS. */
export function isPaletteShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">) {
  return event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}
