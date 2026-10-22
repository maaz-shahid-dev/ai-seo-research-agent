/** One CSV cell, quoted. Leading formula characters are neutralized so spreadsheets never run them. */
export function csvCell(value: string | number | null) {
  if (value === null) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | null>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
