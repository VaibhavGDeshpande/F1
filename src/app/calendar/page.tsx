import Link from "next/link";
import { Img } from "@/components/Img";
import { Countdown, LocalTime } from "@/components/LocalTime";
import { openf1, type Meeting, type Session } from "@/lib/openf1";

export const metadata = { title: "Calendar" };

type M = Meeting & { country_flag?: string; circuit_image?: string; date_end?: string };
const dayRange = (a: string, b: string) => {
  const f = (s: string, o: Intl.DateTimeFormatOptions) => new Date(s).toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
  return `${f(a, { day: "numeric" })}–${f(b, { day: "numeric", month: "short" })}`;
};

export default async function Calendar({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const thisYear = new Date().getUTCFullYear();
  const { year: y } = await searchParams;
  const year = y && /^\d{4}$/.test(y) && +y >= 2023 && +y <= thisYear + 1 ? Number(y) : thisYear;
  const [meetings, sessions] = await Promise.all([openf1<M>("meetings", { year }, 3600), openf1<Session>("sessions", { year }, 600)]);
  const now = Date.now();
  const byStart = (a: { date_start: string }, b: { date_start: string }) => Date.parse(a.date_start) - Date.parse(b.date_start);
  const ordered = [...meetings].sort(byStart);
  const sessOf = (m: M) => sessions.filter((s) => s.meeting_key === m.meeting_key).sort(byStart);
  const end = (m: M) => Date.parse(sessOf(m).at(-1)?.date_end ?? m.date_end ?? m.date_start);
  const next = ordered.find((m) => end(m) > now);
  let round = 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="mr-auto">
          <h1 className="h1">{year} calendar</h1>
          <p className="muted text-sm">Session times are in your timezone. Ticked sessions open their analysis.</p>
        </div>
        {Array.from({ length: thisYear - 2022 }, (_, i) => 2023 + i).map((yr) => (
          <Link key={yr} href={`/calendar?year=${yr}`} className={`pill ${yr === year ? "pill-on" : ""}`}>{yr}</Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {ordered.map((m) => {
          const ss = sessOf(m), testing = /testing/i.test(m.meeting_name), done = end(m) < now, isNext = m === next;
          if (!testing) round++;
          return (
            <div key={m.meeting_key} className={`card relative overflow-hidden ${isNext ? "border-red-600 ring-1 ring-red-600" : ""} ${done ? "opacity-80" : ""}`}>
              <Img src={m.circuit_image} alt={`${m.circuit_short_name} layout`} className="pointer-events-none absolute -right-4 top-6 h-32 w-44 object-contain opacity-20 invert" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-bold">{testing ? "TEST" : `R${round}`}</span>
                  {isNext && <span className="rounded bg-red-600 px-1.5 py-0.5 font-bold">NEXT</span>}
                  {done && <span className="text-neutral-500">Completed</span>}
                  <span className="ml-auto text-neutral-400">{ss.length ? dayRange(ss[0].date_start, ss.at(-1)!.date_start) : ""}</span>
                </div>
                <Link href={`/weekend/${m.meeting_key}`} className="mt-2 flex items-center gap-2 hover:underline">
                  <Img src={m.country_flag} alt="" className="h-4 w-6 rounded-sm object-cover" />
                  <span className="font-display text-2xl font-bold uppercase leading-none">{m.meeting_name}</span>
                </Link>
                <div className="muted text-xs">{m.circuit_short_name}, {m.country_name}</div>
                {isNext && ss[0] && Date.parse(ss[0].date_start) > now && <div className="mt-2 font-display text-2xl font-bold text-red-500"><Countdown iso={ss[0].date_start} /></div>}
                <ul className="mt-3 space-y-1 text-sm">
                  {ss.map((s) => {
                    const live = Date.parse(s.date_start) <= now && now <= Date.parse(s.date_end), past = Date.parse(s.date_end) < now;
                    return (
                      <li key={s.session_key} className="flex justify-between gap-2">
                        {past ? <Link className="link" href={`/session/${s.session_key}`}>✓ {s.session_name}</Link>
                          : live ? <Link className="font-bold text-red-500" href="/live">● {s.session_name}</Link>
                          : <span>{s.session_name}</span>}
                        <span className="muted text-xs">{s.is_cancelled ? "Cancelled" : <LocalTime iso={s.date_start} />}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
