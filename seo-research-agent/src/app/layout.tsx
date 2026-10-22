import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEO Research Agent",
  description: "Run live keyword research and keep results organized by project.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" className={`h-full antialiased${theme === "dark" ? " dark" : ""}`}>
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
