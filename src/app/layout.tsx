import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { openf1, type Meeting, type Session } from "@/lib/openf1";
import "./globals.css";

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-barlow" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });

// every page reads live data (and the shell shows the next session), so nothing is prerendered at build time
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Pit Wall — F1 data & live timing", template: "%s · Pit Wall" },
  description: "Unofficial F1 analysis: live timing, telemetry, tyre degradation, news, penalties and power unit usage.",
};

async function nextSession() {
  try {
    const year = new Date().getUTCFullYear();
    const [sessions, meetings] = await Promise.all([openf1<Session>("sessions", { year }, 600), openf1<Meeting & { country_flag?: string }>("meetings", { year }, 3600)]);
    const s = sessions.filter((x) => Date.parse(x.date_end) > Date.now()).sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0];
    const m = s && meetings.find((x) => x.meeting_key === s.meeting_key);
    return s ? { name: m?.meeting_name ?? s.country_name, session: s.session_name, date: s.date_start, flag: m?.country_flag ?? null } : null;
  } catch {
    return null; // the shell must render even when OpenF1 is unavailable
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen antialiased">
        <AppShell next={await nextSession()}>{children}</AppShell>
      </body>
    </html>
  );
}
