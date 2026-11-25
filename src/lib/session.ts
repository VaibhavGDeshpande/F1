// Session-level data for analysis pages and API routes.
import { circuitInfo } from "./live";
import { compoundSummary, fixFrozen, neutralisedLaps, stintDegradation, withDistance } from "./analysis";
import {
  cacheFor, getSession, isFinished, openf1,
  type CarData, type Driver, type Lap, type Location, type Meeting, type Pit, type Position, type RaceControl, type Session, type Stint,
} from "./openf1";

export const isRace = (s: Pick<Session, "session_type" | "session_name">) => s.session_type === "Race" || /sprint$/i.test(s.session_name);

export async function sessionData(sessionKey: string) {
  const session = await getSession(sessionKey);
  if (!session) return null;
  const c = cacheFor(session, 30), sk = session.session_key;
  const [drivers, laps, stints, rc, pits, positions] = await Promise.all([
    openf1<Driver>("drivers", { session_key: sk }, c),
    openf1<Lap>("laps", { session_key: sk }, c),
    openf1<Stint>("stints", { session_key: sk }, c),
    openf1<RaceControl>("race_control", { session_key: sk }, c),
    openf1<Pit>("pit", { session_key: sk }, c),
    isRace(session) ? openf1<Position>("position", { session_key: sk }, c) : Promise.resolve([] as Position[]),
  ]);
  return { session, drivers, laps, stints, rc, pits, positions };
}

export async function tyreDegradation(sessionKey: string) {
  const session = await getSession(sessionKey);
  return session ? tyreDegradationFor(session) : null;
}

async function tyreDegradationFor(session: Session) {
  const c = cacheFor(session, 30), sk = session.session_key;
  const [laps, stintRows, rc] = await Promise.all([
    openf1<Lap>("laps", { session_key: sk }, c),
    openf1<Stint>("stints", { session_key: sk }, c),
    openf1<RaceControl>("race_control", { session_key: sk }, c),
  ]);
  const stints = stintDegradation(laps, stintRows, neutralisedLaps(rc));
  return { session, stints, summary: compoundSummary(stints) };
}

/** Position of every driver at the end of every lap (race / sprint). */
export function positionsByLap(laps: Lap[], positions: Position[]) {
  const byDriver = new Map<number, Position[]>();
  for (const p of positions) byDriver.set(p.driver_number, [...(byDriver.get(p.driver_number) ?? []), p]);
  for (const ps of byDriver.values()) ps.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const rows = new Map<number, Record<string, number>>();
  for (const l of laps) {
    if (!l.date_start || l.lap_duration == null) continue;
    const end = Date.parse(l.date_start) + l.lap_duration * 1000;
    const pos = byDriver.get(l.driver_number)?.filter((p) => Date.parse(p.date) <= end).at(-1)?.position;
    if (pos == null) continue;
    const row = rows.get(l.lap_number) ?? { lap: l.lap_number };
    row[String(l.driver_number)] = pos;
    rows.set(l.lap_number, row);
  }
  return [...rows.values()].sort((a, b) => a.lap - b.lap);
}

/** Telemetry for one lap: car data with distance, plus location trace for the map. */
export async function lapTelemetry(sessionKey: string, driver: number, lapNumber: number) {
  const session = await getSession(sessionKey);
  if (!session) return null;
  const [lap] = await openf1<Lap>("laps", { session_key: session.session_key, driver_number: driver, lap_number: lapNumber }, cacheFor(session, 30));
  if (!lap?.date_start || !lap.lap_duration) return null;
  const range = {
    session_key: session.session_key, driver_number: driver,
    "date>=": lap.date_start, "date<=": new Date(Date.parse(lap.date_start) + lap.lap_duration * 1000).toISOString(),
  };
  const keep = isFinished(session) ? 86400 : 60;
  const [car, loc, circuit] = await Promise.all([
    openf1<CarData>("car_data", range, keep), openf1<Location>("location", range, keep),
    circuitInfo(session).catch(() => null), // lap length, to repair laps where every feed froze
  ]);
  const t0 = Date.parse(lap.date_start);
  const path = loc.filter((p) => p.x || p.y).map((p) => ({ x: p.x, y: p.y, z: p.z, t: (Date.parse(p.date) - t0) / 1000 }));
  const { points, frozen } = fixFrozen(withDistance(car, lap.date_start), path, circuit?.lapLength);
  return { lap, points, path, frozen };
}

export async function meetingWithSessions(meetingKey: string) {
  const [meeting] = await openf1<Meeting>("meetings", { meeting_key: meetingKey }, 3600);
  if (!meeting) return null;
  const sessions = (await openf1<Session>("sessions", { meeting_key: meetingKey }, 600)).sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  return { meeting, sessions };
}

/** Tyre degradation per compound for every finished session of a weekend: FP1 → Race. */
export async function weekendDegradation(sessions: Session[]) {
  const done = sessions.filter((s) => !s.is_cancelled && Date.parse(s.date_end) < Date.now());
  const out: { session: Session; summary: ReturnType<typeof compoundSummary> | null }[] = [];
  for (const s of done) {
    // sequential on purpose: OpenF1's free tier rate-limits bursts. One failed session must not sink the page.
    try {
      out.push({ session: s, summary: (await tyreDegradationFor(s)).summary });
    } catch (e) {
      console.error(`tyre degradation for session ${s.session_key} failed:`, e);
      out.push({ session: s, summary: null });
    }
  }
  return out;
}
