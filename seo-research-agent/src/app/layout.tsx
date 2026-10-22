import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { DENSITY_COOKIE, parseDensity, parseTheme, THEME_COOKIE } from "@/lib/theme";
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
  const cookieStore = await cookies();
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const density = parseDensity(cookieStore.get(DENSITY_COOKIE)?.value);
  return (
    <html lang="en" className={`h-full antialiased${theme === "dark" ? " dark" : ""}${density === "compact" ? " density-compact" : ""}`}>
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
