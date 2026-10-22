import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ReportActions } from "@/components/report/ReportActions";
import { ReportDocument } from "@/components/report/ReportDocument";
import { slugify } from "@/features/research/blueprint";
import { buildResearchReport, reportToMarkdown } from "@/features/research/report";
import { researchRunIdSchema } from "@/features/research/schemas";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { AppError } from "@/server/http/errors";
import { loadReportData } from "@/server/research/report";

export const metadata: Metadata = { title: "Niche report · SEO Research Agent", robots: { index: false } };

/** Printable report for one finished search, for the signed-in owner only. */
export default async function ReportPage({ params }: { params: Promise<{ runId: string }> }) {
  let user;
  try {
    user = await requireActiveUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") redirect("/sign-in");
    throw error;
  }

  const runId = researchRunIdSchema.safeParse((await params).runId);
  if (!runId.success) notFound();
  const data = await loadReportData(getDatabase(), user.id, runId.data);
  if (!data) notFound();

  const report = buildResearchReport(data.run, data.keywords, data.analysis);
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-8 print:max-w-none print:p-0">
      <ReportActions
        backHref={`/?run=${data.run.id}`}
        markdown={reportToMarkdown(report)}
        fileName={`${slugify(data.run.query) || "research"}-report.md`}
      />
      <ReportDocument report={report} />
    </main>
  );
}
