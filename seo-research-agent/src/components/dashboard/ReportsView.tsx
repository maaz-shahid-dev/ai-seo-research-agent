'use client';

import React, { useState } from 'react';
import { 
  Download, 
  CheckCircle, 
  FileSpreadsheet
} from 'lucide-react';
import type { KeywordResult, SavedReport } from '@/types/seo';
import { exportKeywordsToCSV } from '@/lib/exportCsv';
import { DEMO_SAVED_REPORTS } from '@/data/demo-data';

interface ReportsViewProps {
  keywords: KeywordResult[];
  countryCode: string;
  languageCode: string;
  projectName: string;
  seedKeyword: string;
}

interface ReportSnapshot {
  keywords: KeywordResult[];
  countryCode: string;
  languageCode: string;
  filename: string;
}

type ReportListItem = SavedReport & {
  snapshot?: ReportSnapshot;
};

export const ReportsView: React.FC<ReportsViewProps> = ({
  keywords,
  countryCode,
  languageCode,
  projectName,
  seedKeyword,
}) => {
  const [reportsList, setReportsList] = useState<ReportListItem[]>(() =>
    DEMO_SAVED_REPORTS.map((report) => ({ ...report }))
  );

  const handleExport = () => {
    if (keywords.length === 0) return;

    const safeSeed = seedKeyword
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'keywords';
    const filename = `seo_research_${countryCode.toLowerCase()}_${safeSeed}_demo.csv`;
    const snapshotKeywords = keywords.map((keyword) => ({
      ...keyword,
      trend: keyword.trend ? [...keyword.trend] : undefined,
    }));

    const didDownload = exportKeywordsToCSV(snapshotKeywords, countryCode, languageCode, filename);
    if (!didDownload) return;

    const newRep: ReportListItem = {
      id: `rep_${Date.now()}`,
      name: `${countryCode} Keyword Opportunities Snapshot`,
      project_name: projectName,
      seed_keyword: seedKeyword || 'Not set',
      country: countryCode,
      language: languageCode,
      records_count: snapshotKeywords.length,
      format: 'CSV',
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
      snapshot: {
        keywords: snapshotKeywords,
        countryCode,
        languageCode,
        filename,
      },
    };
    setReportsList((currentReports) => [newRep, ...currentReports]);
  };

  const handleSnapshotDownload = (report: ReportListItem) => {
    if (!report.snapshot) return;

    exportKeywordsToCSV(
      report.snapshot.keywords,
      report.snapshot.countryCode,
      report.snapshot.languageCode,
      report.snapshot.filename
    );
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Reports &amp; Data Export Studio</h1>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              PRD FR-07 Active
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Export keyword opportunities, metrics, provenance source tags, and timestamps for spreadsheet analysis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={keywords.length === 0}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          <span>Download Active CSV ({keywords.length} records)</span>
        </button>
      </div>

      {/* CSV Configuration & Specifications Card */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900">Export Specifications &amp; Column Controls (PRD FR-07)</h3>
          <p className="mt-1 text-xs text-slate-500">
            CSV output is RFC-4180 formatted for Google Sheets, Microsoft Excel, and Numbers with character escaping protections.
          </p>

          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-slate-50 p-3 text-xs font-mono text-slate-700 border border-slate-200 overflow-x-auto">
              <span className="text-slate-400"># Generated RFC-4180 Header:</span><br />
              &quot;Keyword&quot;,&quot;Search Volume&quot;,&quot;Keyword Difficulty (KD)&quot;,&quot;CPC (USD)&quot;,&quot;Search Intent&quot;,&quot;Target Country&quot;,&quot;Target Language&quot;,&quot;Data Source&quot;,&quot;Retrieval Timestamp (UTC)&quot;,&quot;Data Category&quot;
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Zero Metric Invention: Untracked values output as &quot;N/A&quot;</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Full Provenance: Source &amp; UTC Retrieval Date included</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Target Market Context: Country &amp; Language recorded</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Formula Safety: Spreadsheet commands are forced to plain text</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Summary Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">Export Parameters</h3>
          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Records in Buffer:</span>
              <strong className="text-slate-900">{keywords.length} keywords</strong>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Market Identifier:</span>
              <span className="font-semibold text-slate-800">{countryCode} / {languageCode}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Encoding:</span>
              <span className="font-semibold text-slate-800">UTF-8 BOM / RFC-4180</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mode:</span>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Demo Data</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={keywords.length === 0}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Generate &amp; Download CSV</span>
          </button>
        </div>
      </div>

      {/* Saved Reports History Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">Export History &amp; Saved Reports (PRD FR-07)</h3>
          <p className="text-xs text-slate-500">
            New exports retain an exact in-session snapshot. Seeded demo rows are metadata-only because their original CSV payloads are not stored.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 pl-5 pr-3">Report Name</th>
                <th className="px-3 py-3">Project Association</th>
                <th className="px-3 py-3">Market</th>
                <th className="px-3 py-3 text-right">Keyword Count</th>
                <th className="px-3 py-3 text-center">Format</th>
                <th className="px-3 py-3">Created Timestamp</th>
                <th className="py-3 pl-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {reportsList.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 pl-5 pr-3 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      <span>{rep.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-slate-600">
                    {rep.project_name}
                  </td>
                  <td className="px-3 py-3.5 text-slate-600">
                    {rep.country} ({rep.language})
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-900">
                    {rep.records_count}
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {rep.format}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-slate-500 text-[11px]">
                    {rep.created_at}
                  </td>
                  <td className="py-3.5 pl-3 pr-5 text-right">
                    {rep.snapshot ? (
                      <button
                        type="button"
                        onClick={() => handleSnapshotDownload(rep)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                        aria-label={`Download saved snapshot: ${rep.name}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download snapshot</span>
                      </button>
                    ) : (
                      <span
                        className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"
                        title="This demo history row contains metadata only; no original CSV snapshot is available."
                      >
                        Metadata only
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
