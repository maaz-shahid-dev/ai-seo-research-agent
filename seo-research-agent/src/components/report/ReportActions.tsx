"use client";

import { ArrowLeft, Download, Printer } from "lucide-react";

import { Button, buttonStyles } from "@/components/ui/Button";
import { downloadFile } from "@/lib/download";

/** Back, print and Markdown download; hidden when printing. */
export function ReportActions({ backHref, markdown, fileName }: { backHref: string; markdown: string; fileName: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <a href={backHref} className={buttonStyles({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to research
      </a>
      <span className="flex-1" />
      <Button variant="secondary" size="sm" onClick={() => downloadFile(fileName, markdown, "text/markdown;charset=utf-8")}>
        <Download className="h-4 w-4" aria-hidden="true" /> Markdown
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden="true" /> Print or save as PDF
      </Button>
    </div>
  );
}
