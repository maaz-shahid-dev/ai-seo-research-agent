import type { ReactNode } from "react";

import { formatReportDate, type ResearchReport } from "@/features/research/report";
import { titleCase } from "@/lib/format";

const numberFormat = new Intl.NumberFormat("en-US");
const num = (value: number | null) => (value === null ? "—" : numberFormat.format(value));

/** The printable report: plain document styles that read well on screen and paper. */
export function ReportDocument({ report }: { report: ResearchReport }) {
  return (
    <article className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-10 print:border-0 print:p-0">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Niche report</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{titleCase(report.title)}</h1>
        <p className="mt-1 text-sm text-slate-500">{report.market} · {formatReportDate(report.createdAt)}</p>
        <dl className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Keywords" value={num(report.stats.keywords)} />
          <Stat label="Monthly searches" value={num(report.stats.monthlySearches)} />
          <Stat label="Average KD" value={report.stats.averageDifficulty === null ? "—" : `${report.stats.averageDifficulty} / 100`} />
        </dl>
      </header>

      {report.summary ? (
        <Section title="Summary">
          <p className="text-sm leading-relaxed text-slate-700">{report.summary}</p>
          {report.nextSteps.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {report.nextSteps.map((step) => <li key={step}>{step}</li>)}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {report.topOpportunities.length ? (
        <Section title="Top opportunities">
          <Table headers={["Keyword", "Opportunity", "Volume", "KD"]} numeric={[false, false, true, true]}>
            {report.topOpportunities.map((row) => (
              <tr key={row.keyword}>
                <Td>{row.keyword}</Td>
                <Td>{row.score} · {row.tier}</Td>
                <Td numeric>{num(row.searchVolume)}</Td>
                <Td numeric>{num(row.difficulty)}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      ) : null}

      {report.coverage.length ? (
        <Section title="Content coverage">
          <div className="grid gap-4 sm:grid-cols-2">
            {report.coverage.map((group) => (
              <div key={group.label} className="break-inside-avoid">
                <h3 className="text-sm font-semibold text-slate-900">{group.label}</h3>
                <p className="text-xs text-slate-500">{group.count} keywords · {group.easyCount} easy · {num(group.totalVolume)} searches/mo</p>
                <ul className="mt-1.5 space-y-0.5 text-sm text-slate-700">
                  {group.examples.map((example) => <li key={example}>{example}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {report.clusters.length ? (
        <Section title={`Content plan · top ${report.clusters.length} of ${report.totalClusters} pages`}>
          <Table headers={["Topic", "Page type", "Best keyword", "Volume", "Avg KD"]} numeric={[false, false, false, true, true]}>
            {report.clusters.map((cluster) => (
              <tr key={cluster.topic}>
                <Td>{titleCase(cluster.topic)}</Td>
                <Td>{cluster.type}</Td>
                <Td>{cluster.mainKeyword}</Td>
                <Td numeric>{num(cluster.totalVolume)}</Td>
                <Td numeric>{num(cluster.averageDifficulty)}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      ) : null}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid-page">
      <h2 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 print:border print:border-slate-200">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function Table({ headers, numeric, children }: { headers: string[]; numeric: boolean[]; children: ReactNode }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            {headers.map((header, index) => (
              <th key={header} scope="col" className={`py-2 pr-3 font-medium ${numeric[index] ? "text-right" : ""}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return <td className={`py-2 pr-3 text-slate-800 ${numeric ? "text-right tabular-nums" : ""}`}>{children}</td>;
}
