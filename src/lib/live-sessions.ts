// Session list shared by the Live page and the telemetry dashboard: every started session this season (newest first),
// which one is live right now, and the next one coming up.
import { openf1, type Meeting, type Session } from "./openf1";

export async function liveSessions() {
  const year = new Date().getUTCFullYear();
  const [sessions, meetings] = await Promise.all([
    openf1<Session>("sessions", { year }, 300),
    openf1<Meeting>("meetings", { year }, 3600),
  ]);
  const now = Date.now();
  const name = new Map(meetings.map((m) => [m.meeting_key, m.meeting_name]));
  const label = (s: Session) => `${name.get(s.meeting_key) ?? s.country_name} — ${s.session_name}`;
  const started = sessions
    .filter((s) => !s.is_cancelled && Date.parse(s.date_start) - 15 * 60_000 <= now)
    .sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start));
  const live = started.find((s) => now <= Date.parse(s.date_end) + 30 * 60_000) ?? null;
  const next = sessions.filter((s) => Date.parse(s.date_start) > now).sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0] ?? null;
  return {
    options: started.map((s) => ({ session_key: s.session_key, label: label(s), date_start: s.date_start, date_end: s.date_end })),
    liveKey: live?.session_key ?? null,
    next: next ? { label: label(next), date_start: next.date_start } : null,
  };
}
