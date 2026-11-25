import { LiveDashboard, type SessionOption } from "@/components/LiveDashboard";
import { openf1, type Meeting, type Session } from "@/lib/openf1";

export const metadata = { title: "Live timing" };
export const revalidate = 60;

export default async function Live() {
  const year = new Date().getUTCFullYear();
  const [sessions, meetings] = await Promise.all([
    openf1<Session>("sessions", { year }, 300),
    openf1<Meeting>("meetings", { year }, 3600),
  ]);
  const now = Date.now();
  const name = new Map(meetings.map((m) => [m.meeting_key, m.meeting_name]));
  const started = sessions
    .filter((s) => !s.is_cancelled && Date.parse(s.date_start) - 15 * 60_000 <= now)
    .sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start));
  const live = started.find((s) => now <= Date.parse(s.date_end) + 30 * 60_000) ?? null;
  const next = sessions.filter((s) => Date.parse(s.date_start) > now).sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0] ?? null;
  const options: SessionOption[] = started.map((s) => ({
    session_key: s.session_key, label: `${name.get(s.meeting_key) ?? s.country_name} — ${s.session_name}`,
    date_start: s.date_start, date_end: s.date_end,
  }));

  return (
    <LiveDashboard
      sessions={options}
      liveKey={live?.session_key ?? null}
      next={next ? { label: `${name.get(next.meeting_key) ?? next.country_name} — ${next.session_name}`, date_start: next.date_start } : null}
    />
  );
}
