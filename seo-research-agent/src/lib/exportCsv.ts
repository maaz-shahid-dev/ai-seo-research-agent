import type { KeywordResult } from '@/types/seo';

type CsvCell = string | number | null | undefined;

const CSV_HEADERS = [
  'Keyword',
  'Search Volume',
  'Keyword Difficulty (KD)',
  'CPC (USD)',
  'Search Intent',
  'Target Country',
  'Target Language',
  'Data Source',
  'Retrieval Timestamp (UTC)',
  'Data Category',
] as const;

/**
 * Spreadsheet applications can evaluate formula-like strings even when the
 * values are correctly quoted CSV fields. Prefixing an apostrophe forces those
 * values to remain text when a user opens the file in a spreadsheet.
 */
function neutralizeSpreadsheetFormula(value: string): string {
  return /^(?:[\t\r\n]|[ \t\r\n]*[=+\-@])/.test(value) ? `'${value}` : value;
}

function serializeCsvCell(value: CsvCell): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '"N/A"';
  }

  const safeValue = neutralizeSpreadsheetFormula(value ?? 'N/A');
  return `"${safeValue.replace(/"/g, '""')}"`;
}

/**
 * Builds a deterministic RFC-4180 CSV document without accessing browser APIs.
 * Numeric metrics are emitted as unquoted numbers so spreadsheet applications
 * can sort, sum, and chart them without converting text cells first.
 */
export function buildKeywordsCSV(
  keywords: readonly KeywordResult[],
  countryCode: string,
  languageCode: string
): string {
  const rows: CsvCell[][] = keywords.map((keyword) => [
    keyword.keyword,
    keyword.search_volume,
    keyword.keyword_difficulty,
    keyword.cpc,
    keyword.intent,
    countryCode,
    languageCode,
    keyword.source,
    keyword.retrieved_at,
    'DEMO_SAMPLE_DATA',
  ]);

  return [CSV_HEADERS, ...rows]
    .map((row) => row.map(serializeCsvCell).join(','))
    .join('\r\n');
}

function downloadCsvDocument(csvContent: string, filename: string): void {
  // A UTF-8 BOM keeps non-ASCII keywords and market names readable in Excel.
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Safely exports keyword data to CSV file formatted for spreadsheet applications.
 * Implements FR-07: includes keyword, country, language, metrics, source, and retrieval time.
 * Returns false when there is no data, allowing callers to avoid recording a
 * report that was never downloaded.
 */
export function exportKeywordsToCSV(
  keywords: readonly KeywordResult[],
  countryCode: string,
  languageCode: string,
  filename = 'seo_keyword_research_demo.csv'
): boolean {
  if (keywords.length === 0) return false;

  downloadCsvDocument(buildKeywordsCSV(keywords, countryCode, languageCode), filename);
  return true;
}
