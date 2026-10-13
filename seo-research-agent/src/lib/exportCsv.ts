import { KeywordResult } from '@/types/seo';

/**
 * Safely exports keyword data to CSV file formatted for spreadsheet applications.
 * Implements FR-07: includes keyword, country, language, metrics, source, and retrieval time.
 * Escapes CSV special characters to protect against malformed content.
 */
export function exportKeywordsToCSV(
  keywords: KeywordResult[],
  countryCode: string,
  languageCode: string,
  filename = 'seo_keyword_research_demo.csv'
) {
  if (keywords.length === 0) return;

  const headers = [
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
  ];

  const escapeCSV = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = keywords.map((k) => [
    escapeCSV(k.keyword),
    escapeCSV(k.search_volume ?? 'N/A'),
    escapeCSV(k.keyword_difficulty ?? 'N/A'),
    escapeCSV(k.cpc !== null ? `$${k.cpc.toFixed(2)}` : 'N/A'),
    escapeCSV(k.intent ?? 'N/A'),
    escapeCSV(countryCode),
    escapeCSV(languageCode),
    escapeCSV(k.source),
    escapeCSV(k.retrieved_at),
    escapeCSV('DEMO_SAMPLE_DATA'),
  ]);

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
