import { PitWall, type PWDriver } from "@/components/PitWall";
import { getSession, openf1, teamColour, type Driver, type Lap, type Meeting, type Session, type Stint } from "@/lib/openf1";

export const metadata = { title: "Pit Wall" };

const CODES: [RegExp, string][] = [
  [/^practice 1$/i, "FP1"], [/^practice 2$/i, "FP2"], [/^practice 3$/i, "FP3"], [/sprint (qualifying|shootout)/i, "SQ"],
  [/^sprint$/i, "S"], [/^qualifying$/i, "Q"], [/^race$/i, "R"],
];
const codeOf = (name: string) => CODES.find(([re]) => re.test(name))?.[1] ?? name;
const byStart = (a: { date_start: string }, b: { date_start: string }) => Date.parse(a.date_start) - Date.parse(b.date_start);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** /pit-wall?year=&round=&session=Q&mode=overlay&drivers=VER,LEC&ref=VER&fastest=1  (or &sk=<session_key>, &laps=VER:11,LEC:24) */
export default async function PitWallPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear(), now = Date.now();
  let year = /^\d{4}$/.test(one(sp.year)) && +one(sp.year) >= 2023 && +one(sp.year) <= thisYear ? +one(sp.year) : thisYear;
  let session: Session | null = /^\d{1,6}$/.test(one(sp.sk)) ? await getSession(one(sp.sk)) : null;
  if (session) year = session.year;

  const [meetingRows, allSessions] = await Promise.all([
    openf1<Meeting & { country_flag?: string }>("meetings", { year }, 3600),
    openf1<Session>("sessions", { year }, 600),
  ]);
  const started = (s: Session) => !s.is_cancelled && Date.parse(s.date_start) < now;
  const meetings = meetingRows.filter((m) => !/testing/i.test(m.meeting_name)).sort(byStart).map((m, i) => ({ ...m, round: i + 1 }));
  const meeting =
    (session && meetings.find((m) => m.meeting_key === session!.meeting_key)) ||
    meetings.find((m) => m.round === Number(one(sp.round))) ||
    [...meetings].reverse().find((m) => allSessions.some((s) => s.meeting_key === m.meeting_key && started(s)));
  if (!meeting) return <p className="muted">No sessions in {year} yet.</p>;

  const sessions = allSessions.filter((s) => s.meeting_key === meeting.meeting_key).sort(byStart);
  if (!session || session.meeting_key !== meeting.meeting_key) {
    const want = one(sp.session).toUpperCase();
    const ran = sessions.filter(started);
    session = ran.find((s) => codeOf(s.session_name) === want) ?? ran.find((s) => codeOf(s.session_name) === "Q") ?? ran.at(-1) ?? null;
  }

  const base = {
    year, years: Array.from({ length: thisYear - 2022 }, (_, i) => thisYear - i),
    meetings: meetings.map((m) => ({ round: m.round, name: m.meeting_name })), round: meeting.round,
    title: `${year} ${meeting.meeting_name}`, flag: meeting.country_flag ?? null,
    sessions: sessions.map((s) => ({ code: codeOf(s.session_name), name: s.session_name, started: started(s) })),
  };
  if (!session) return <PitWall {...base} sessionCode="" sessionKey={0} drivers={[]} stints={[]} initial={{ codes: [], ref: "", mode: "overlay", picks: {} }} />;

  const sk = session.session_key;
  const [driverRows, laps, stints] = await Promise.all([
    openf1<Driver>("drivers", { session_key: sk }, 3600),
    openf1<Lap>("laps", { session_key: sk }, 600),
    openf1<Stint>("stints", { session_key: sk }, 600),
  ]);
  const drivers: PWDriver[] = driverRows
    .map((d) => ({
      n: d.driver_number, code: d.name_acronym, name: d.full_name, team: d.team_name, colour: teamColour(d), headshot: d.headshot_url,
      laps: laps.filter((l) => l.driver_number === d.driver_number && l.lap_duration && !l.is_pit_out_lap).map((l) => ({ lap: l.lap_number, time: l.lap_duration! })),
    }))
    .sort((a, b) => Math.min(Infinity, ...a.laps.map((l) => l.time)) - Math.min(Infinity, ...b.laps.map((l) => l.time)));

  const known = new Set(drivers.map((d) => d.code));
  let codes = one(sp.drivers).toUpperCase().split(",").filter((c) => known.has(c)).slice(0, 4);
  if (!codes.length) codes = drivers.slice(0, 2).map((d) => d.code);
  const ref = codes.includes(one(sp.ref).toUpperCase()) ? one(sp.ref).toUpperCase() : codes[0];
  const picks: Record<string, number> = {};
  for (const p of one(sp.laps).split(",")) {
    const [c, l] = p.toUpperCase().split(":");
    if (known.has(c) && /^\d{1,3}$/.test(l ?? "")) picks[c] = Number(l);
  }

  return (
    <PitWall key={sk} {...base} sessionCode={codeOf(session.session_name)} sessionKey={sk} drivers={drivers} stints={stints}
      initial={{ codes, ref, mode: one(sp.mode) === "focus" ? "focus" : "overlay", picks }} />
  );
}
