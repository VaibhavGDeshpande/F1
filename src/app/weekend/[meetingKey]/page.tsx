import Link from "next/link";
import { Suspense } from "react";
import { WeekendPreview } from "@/components/WeekendPreview";
import { ForecastChip } from "@/components/ForecastChip";
import { sessionForecasts, type Forecast } from "@/lib/weather";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { fmtLap } from "@/lib/analysis";
import { getEvents } from "@/lib/fia";
import { compoundColour } from "@/lib/openf1";
import { meetingWithSessions, weekendDegradation } from "@/lib/session";

export const revalidate = 300;

export default async function Weekend({ params }: { params: Promise<{ meetingKey: string }> }) {
  const { meetingKey } = await params;
  if (!/^\d{1,6}$/.test(meetingKey)) notFound();
  const mw = await meetingWithSessions(meetingKey);
  if (!mw) notFound();
  const { meeting, sessions } = mw;
  const [deg, events, forecast] = await Promise.all([
    weekendDegradation(sessions), getEvents(meeting.year).catch(() => []), sessionForecasts(meeting, sessions).catch(() => ({}) as Record<number, Forecast>),
  ]);
  const fia = events.find((e) => e.name.toLowerCase() === meeting.meeting_name.toLowerCase());
  const compounds = [...new Set(deg.flatMap((d) => d.summary?.map((s) => s.compound) ?? []))];
  const now = Date.now();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">{meeting.meeting_name} {meeting.year}</h1>
        <div className="muted text-sm">{meeting.meeting_official_name} · {meeting.circuit_short_name}, {meeting.country_name}</div>
        {fia && <Link href={`/paddock?event=${fia.id}`} className="link mt-1 inline-block text-sm">Penalties, PU elements &amp; FIA documents →</Link>}
      </header>

      <Suspense fallback={<section className="card muted text-sm">Building the weekend preview (track profile, form, history)…</section>}>
        <WeekendPreview meeting={meeting} sessions={sessions} />
      </Suspense>

      <section className="card">
        <h2 className="h2">Sessions</h2>
        <ul className="divide-y divide-neutral-900 text-sm">
          {sessions.map((s) => {
            const done = Date.parse(s.date_end) < now, live = Date.parse(s.date_start) <= now && !done;
            return (
              <li key={s.session_key} className="flex justify-between py-2">
                {done ? <Link href={`/session/${s.session_key}`} className="link">{s.session_name}</Link>
                  : live ? <Link href="/live" className="font-bold text-red-500">● {s.session_name} — live</Link> : <span>{s.session_name}</span>}
                <span className="flex flex-wrap items-center justify-end gap-x-4">
                  {forecast[s.session_key] && <ForecastChip f={forecast[s.session_key]} />}
                  <span className="muted">{s.is_cancelled ? "Cancelled" : <LocalTime iso={s.date_start} />}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="h2">Tyre degradation across the weekend</h2>
        <p className="muted mb-3 text-xs">Median seconds lost per lap of tyre age (fuel-corrected estimate) and median pace per compound. Practice = long runs only.</p>
        {deg.length === 0 ? <p className="muted text-sm">No sessions run yet.</p> : (
          <table className="tbl">
            <thead><tr><th>Session</th>{compounds.map((c) => <th key={c} style={{ color: compoundColour(c) }}>{c}</th>)}</tr></thead>
            <tbody>
              {deg.map(({ session, summary }) => (
                <tr key={session.session_key}>
                  <td><Link href={`/session/${session.session_key}`} className="link">{session.session_name}</Link></td>
                  {!summary && <td colSpan={Math.max(1, compounds.length)} className="muted">Data source busy (rate limit) — reload in a minute</td>}
                  {summary && compounds.map((c) => {
                    const s = summary.find((x) => x.compound === c);
                    return <td key={c} className="font-mono">{s ? <>{s.deg >= 0 ? "+" : ""}{s.deg.toFixed(3)} s/lap <span className="muted text-xs">· {fmtLap(s.pace)} · {s.stints} stints</span></> : <span className="muted">—</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
