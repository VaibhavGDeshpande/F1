import Link from "next/link";
import { CalendarDays, Gauge, Newspaper, Radio, ScrollText, TrendingUp, Trophy, Users } from "lucide-react";
import { ForecastChip } from "@/components/ForecastChip";
import { Img } from "@/components/Img";
import { sessionForecasts, type Forecast } from "@/lib/weather";
import { Countdown, LocalTime } from "@/components/LocalTime";
import { teamLogo } from "@/lib/media";
import { fiaUrl, latestStewardsDocs } from "@/lib/fia";
import { constructorStandings, driverStandings, lastRaceResults } from "@/lib/jolpica";
import { getNews } from "@/lib/news";
import { openf1, teamColour, type Driver, type Meeting, type Session } from "@/lib/openf1";

export const revalidate = 120;

// each panel loads independently: one slow or failing source must not blank the dashboard
const safe = <T,>(p: Promise<T>, fallback: T) => p.catch((e) => { console.error(e); return fallback; });

function Panel({ title, icon: Icon, href, className = "", children }: {
  title: React.ReactNode; icon: React.ComponentType<{ size?: number }>; href?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`card flex max-h-[460px] min-h-0 flex-col p-3 lg:max-h-none ${className}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icon size={14} /><span className="truncate">{title}</span>
        {href && <Link href={href} className="link ml-auto shrink-0 text-xs font-normal">More →</Link>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
    </section>
  );
}

export default async function Home() {
  const year = new Date().getUTCFullYear();
  const [sessions, meetings, drivers, standings, teams, last, news, fia] = await Promise.all([
    safe(openf1<Session>("sessions", { year }, 600), []),
    safe(openf1<Meeting & { country_flag?: string }>("meetings", { year }, 3600), []),
    safe(openf1<Driver>("drivers", { session_key: "latest" }, 900), []),
    safe(driverStandings(), []),
    safe(constructorStandings(), []),
    safe(lastRaceResults(), null),
    getNews(),
    safe(latestStewardsDocs(), null),
  ]);

  const now = Date.now();
  const byStart = [...sessions].sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  const live = byStart.find((s) => Date.parse(s.date_start) - 15 * 60_000 <= now && now <= Date.parse(s.date_end) + 30 * 60_000);
  const next = byStart.find((s) => Date.parse(s.date_start) > now);
  const focus = live ?? next ?? byStart.at(-1);
  const meeting = meetings.find((m) => m.meeting_key === focus?.meeting_key);
  const weekend = byStart.filter((s) => s.meeting_key === focus?.meeting_key);
  const latestDone = byStart.filter((s) => Date.parse(s.date_end) < now).at(-1);
  const forecast = meeting ? await safe(sessionForecasts(meeting, weekend), {} as Record<number, Forecast>) : {};

  const colourOf = (code?: string) => teamColour(drivers.find((d) => d.name_acronym === code));
  const teamColourOf = (name: string) => teamColour(drivers.find((d) => d.team_name.toLowerCase().includes(name.split(" ")[0].toLowerCase())));
  const leaderPts = Number(standings[0]?.points ?? 1) || 1;
  const teamLeaderPts = Number(teams[0]?.points ?? 1) || 1;

  return (
    <div className="grid gap-3 lg:h-[calc(100vh-7.5rem)] lg:grid-cols-12 lg:grid-rows-2">
      {/* weekend / countdown */}
      <Panel className="lg:col-span-4" icon={live ? Radio : CalendarDays} href={meeting && `/weekend/${meeting.meeting_key}`}
        title={live ? <span className="text-red-500">● LIVE NOW</span> : next ? "Next session" : "Season complete"}>
        {focus && (
          <>
            <div className="flex items-center gap-2">
              {meeting?.country_flag && <img src={meeting.country_flag} alt="" className="h-4 w-6 rounded-sm object-cover" />}
              <span className="font-display text-2xl font-bold uppercase leading-none">{meeting?.meeting_name ?? focus.country_name}</span>
            </div>
            <div className="muted mt-1 text-xs">{focus.session_name} · <LocalTime iso={focus.date_start} /></div>
            {forecast[focus.session_key] && <div className="mt-1"><ForecastChip f={forecast[focus.session_key]} /></div>}
            {!live && next && <div className="mt-2 font-display text-4xl font-bold text-red-500"><Countdown iso={next.date_start} /></div>}
            <ul className="mt-3 space-y-1 text-sm">
              {weekend.map((s) => {
                const done = Date.parse(s.date_end) < now, on = s === live;
                return (
                  <li key={s.session_key} className="flex justify-between gap-2">
                    {done ? <Link href={`/session/${s.session_key}`} className="link">✓ {s.session_name}</Link>
                      : on ? <Link href="/live" className="font-bold text-red-500">● {s.session_name}</Link>
                      : <span className="text-neutral-300">{s.session_name}</span>}
                    <span className="muted text-xs">{s.is_cancelled ? "Cancelled" : <LocalTime iso={s.date_start} />}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/live" className="pill pill-on flex items-center gap-1"><Radio size={12} />Live timing</Link>
              {meeting && <Link href={`/weekend/${meeting.meeting_key}#preview`} className="pill flex items-center gap-1"><TrendingUp size={12} />Weekend preview</Link>}
              <Link href="/pit-wall" className="pill flex items-center gap-1"><Gauge size={12} />Pit Wall</Link>
              {latestDone && <Link href={`/session/${latestDone.session_key}`} className="pill">Latest: {latestDone.session_name}</Link>}
            </div>
          </>
        )}
      </Panel>

      {/* last race */}
      <Panel className="lg:col-span-4" icon={Trophy} title={last ? `Last race · ${last.raceName}` : "Last race"} href="/calendar">
        {!last?.Results ? <p className="muted text-sm">No results yet.</p> : (
          <table className="tbl text-xs">
            <tbody>
              {last.Results.slice(0, 20).map((r) => (
                <tr key={r.Driver.driverId}>
                  <td className={`w-6 font-bold ${Number(r.position) <= 3 ? "text-amber-300" : "text-neutral-400"}`}>{r.positionText}</td>
                  <td><span className="mr-1.5 inline-block h-3 w-1 align-middle" style={{ background: colourOf(r.Driver.code) }} />
                    <Link href={`/drivers/${r.Driver.driverId}`} className="font-semibold hover:underline">{r.Driver.code ?? r.Driver.familyName}</Link>
                    <span className="muted"> {r.Constructor.name}</span></td>
                  <td className="w-8 text-right font-mono text-[11px]" title="Places gained or lost from the start">
                    {(() => { const g = Number(r.grid) - Number(r.position); return !Number(r.grid) || !Number(r.positionText) || !g ? "" : g > 0 ? <span className="text-emerald-400">▲{g}</span> : <span className="text-red-400">▼{-g}</span>; })()}
                  </td>
                  <td className="text-right font-mono text-neutral-300">{r.Time?.time ?? r.status}</td>
                  <td className="w-8 text-right font-mono">{Number(r.points) ? `+${r.points}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* drivers' championship */}
      <Panel className="lg:col-span-4" icon={Trophy} title="Drivers' championship" href="/standings">
        <ul className="space-y-1 text-xs">
          {standings.map((s) => (
            <li key={s.Driver.driverId} className="flex items-center gap-2">
              <span className="w-5 text-right text-neutral-400">{s.positionText}</span>
              <Img src={drivers.find((d) => d.name_acronym === s.Driver.code)?.headshot_url} alt="" className="h-5 w-5 rounded-full bg-neutral-800 object-cover" fallback={<span className="h-5 w-5" />} />
              <Link href={`/drivers/${s.Driver.driverId}`} className="w-28 truncate hover:underline">{s.Driver.givenName[0]}. {s.Driver.familyName}</Link>
              <span className="h-1.5 flex-1 rounded-full bg-neutral-900">
                <span className="block h-1.5 rounded-full" style={{ width: `${(Number(s.points) / leaderPts) * 100}%`, background: colourOf(s.Driver.code) }} />
              </span>
              <span className="w-9 text-right font-mono">{s.points}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* news */}
      <Panel className="lg:col-span-5" icon={Newspaper} title="Latest news" href="/news">
        <ul className="divide-y divide-neutral-900">
          {news.slice(0, 25).map((n) => (
            <li key={n.link} className="py-1.5">
              <a href={n.link} target="_blank" rel="noreferrer" className="text-sm leading-snug hover:underline">{n.title}</a>
              <div className="text-[11px] text-neutral-500">{n.source}{n.date && <> · <LocalTime iso={n.date} /></>}</div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* stewards */}
      <Panel className="lg:col-span-4" icon={ScrollText} title={`Stewards${fia ? ` · ${fia.event.name}` : ""}`} href={fia ? `/paddock?event=${fia.event.id}` : "/paddock"}>
        {!fia?.docs.length ? <p className="muted text-sm">No decisions published.</p> : (
          <ul className="space-y-1.5 text-xs">
            {fia.docs.map((d) => (
              <li key={d.path} className="flex gap-2">
                <span className={`h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${d.kind === "summons" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>
                  {d.kind === "summons" ? "SUMMONS" : "DECISION"}
                </span>
                <a href={fiaUrl(d.path)} target="_blank" rel="noreferrer" className="hover:underline">{d.title.replace(/^(Infringement|Decision|Offence|Summons)\s*-\s*/i, "")}</a>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* constructors */}
      <Panel className="lg:col-span-3" icon={Users} title="Constructors" href="/teams">
        <ul className="space-y-1.5 text-xs">
          {teams.map((t) => (
            <li key={t.Constructor.constructorId}>
              <div className="flex justify-between">
                <Link href={`/teams/${t.Constructor.constructorId}`} className="flex items-center gap-1.5 hover:underline">
                  <span className="w-4 text-neutral-400">{t.positionText}</span><Img src={teamLogo(t.Constructor.name, 32)} alt="" className="h-3.5 w-auto" />{t.Constructor.name}
                </Link>
                <span className="font-mono">{t.points}</span>
              </div>
              <span className="mt-0.5 block h-1 rounded-full bg-neutral-900">
                <span className="block h-1 rounded-full" style={{ width: `${(Number(t.points) / teamLeaderPts) * 100}%`, background: teamColourOf(t.Constructor.name) }} />
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
