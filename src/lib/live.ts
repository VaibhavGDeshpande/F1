// Live / replay timing state at an instant t, built from OpenF1. Live = t is "now"; replay = t moves through a past session.
import {
  cacheFor, getSession, openf1,
  type CarData, type Driver, type Interval, type Lap, type Location, type Position, type RaceControl,
  type Session, type Stint, type TeamRadio, type Weather,
} from "./openf1";
import { cornerName } from "./corner-names";
import { compoundSummary, neutralisedLaps, stintDegradation } from "./analysis";
import { DEFAULT_DEG, raceLaps, strategy, type StratRow, type Threat } from "./strategy";

const isRaceSession = (s: Pick<Session, "session_type" | "session_name">) => s.session_type === "Race" || /sprint$/i.test(s.session_name);

export type Sector = { time: number | null; colour: "purple" | "green" | "yellow" | null };
export type TowerRow = {
  driver_number: number; acronym: string; name: string; team: string; colour: string;
  position: number | null; gap: string | null; interval: string | null;
  lap: number | null; lastLap: number | null; bestLap: number | null; sectors: Sector[];
  compound: string | null; tyreAge: number | null; pits: number;
  gapS: number | null; // gap to leader in seconds (leader 0; null = lapped/unknown)
  out: boolean; // stopped / retired (race only)
};
/** Car positions over a short window around t: [epoch ms, x, y], oldest first. The client interpolates between them. */
export type Trail = [number, number, number][];
export type LiveState = {
  session: Session; t: string; live: boolean; status: string;
  weather: Weather | null; tower: TowerRow[]; trails: Record<number, Trail>;
  raceControl: RaceControl[]; radio: (TeamRadio & { acronym: string })[];
  telemetry: { t: number; speed: number; throttle: number; brake: number; gear: number }[] | null;
  race: boolean;
  strategy: {
    pitLoss: number; underSC: boolean; totalLaps: number | null; lapsLeft: number | null;
    deg: Record<string, { value: number; measured: boolean }>; rows: StratRow[]; threats: Threat[];
  } | null;
};

const ms = Date.parse;
const fmtGap = (v: number | string | null | undefined) => (v == null ? null : typeof v === "number" ? `+${v.toFixed(3)}` : String(v));

function latestBy<R extends { driver_number: number; date: string }>(rows: R[], t: number) {
  const m = new Map<number, R>();
  for (const r of rows) {
    if (ms(r.date) > t) continue;
    const p = m.get(r.driver_number);
    if (!p || ms(r.date) > ms(p.date)) m.set(r.driver_number, r);
  }
  return m;
}

function trackStatus(rc: RaceControl[]): string {
  let status = "GREEN";
  for (const m of rc) {
    const msg = m.message.toUpperCase();
    if (msg.includes("VIRTUAL SAFETY CAR DEPLOYED")) status = "VSC";
    else if (msg.includes("SAFETY CAR DEPLOYED")) status = "SAFETY CAR";
    else if (m.flag === "RED") status = "RED FLAG";
    else if (/VSC ENDING|SAFETY CAR IN THIS LAP/.test(msg)) status = "SC ENDING";
    else if (m.flag === "CHEQUERED") status = "CHEQUERED";
    else if ((m.flag === "GREEN" || m.flag === "CLEAR") && m.scope === "Track") status = "GREEN";
  }
  return status;
}

export async function liveState(sessionKey: string, at?: string, driver?: number): Promise<LiveState> {
  const session = await getSession(sessionKey);
  if (!session) throw new Error("Session not found");
  const live = !at;
  const t = at ? ms(at) : Date.now() - 3000; // small delay so the newest rows have landed in OpenF1
  const T = new Date(t).toISOString();
  const sk = session.session_key;
  const c = (s: number) => cacheFor(session, s);
  // High-frequency data: live = small window ending now (fresh every poll). Replay = fixed 2-minute chunks that are
  // cached, so scrubbing through a past session costs a few requests per minute instead of a few per tick.
  const CHUNK = 120_000;
  const cs = Math.floor(t / CHUNK) * CHUNK;
  const win = (lookback: number) =>
    live
      ? { "date>": new Date(t - lookback * 1000).toISOString(), "date<=": T }
      : { "date>": new Date(cs - lookback * 1000).toISOString(), "date<=": new Date(cs + CHUNK).toISOString() };
  const ttl = live ? 0 : c(30);
  // Track trails. Live: the last 8 s (the client draws ~4 s behind real time so it always has a point to move towards).
  // Replay: from 2 s before t to 40 s ahead (covers a 16× replay until the next poll), using the cached 2-minute chunks.
  const iso = (x: number) => new Date(x).toISOString();
  const [from, to] = live ? [t - 8000, t] : [t - 2000, t + 40_000];
  const locQueries = live
    ? [{ "date>": iso(from), "date<=": T }]
    : Array.from({ length: Math.floor(to / CHUNK) - Math.floor(from / CHUNK) + 1 }, (_, i) => {
        const c0 = (Math.floor(from / CHUNK) + i) * CHUNK;
        return { "date>": iso(c0), "date<=": iso(c0 + CHUNK) };
      });

  const [drivers, positions, laps, stints, rc, radio, weather, intervals, locChunks, car] = await Promise.all([
    openf1<Driver>("drivers", { session_key: sk }, c(300)),
    openf1<Position>("position", { session_key: sk }, c(5)),
    openf1<Lap>("laps", { session_key: sk }, c(10)),
    openf1<Stint>("stints", { session_key: sk }, c(30)),
    openf1<RaceControl>("race_control", { session_key: sk }, c(10)),
    openf1<TeamRadio>("team_radio", { session_key: sk }, c(30)),
    openf1<Weather>("weather", { session_key: sk }, c(60)),
    openf1<Interval>("intervals", { session_key: sk, ...win(30) }, ttl),
    Promise.all(locQueries.map((q) => openf1<Location>("location", { session_key: sk, ...q }, ttl))),
    driver ? openf1<CarData>("car_data", { session_key: sk, driver_number: driver, ...win(40) }, ttl) : Promise.resolve([] as CarData[]),
  ]);

  const pos = latestBy(positions, t), gaps = latestBy(intervals, t);
  const trails: Record<number, Trail> = {};
  for (const l of locChunks.flat()) {
    const at = ms(l.date);
    if (at < from || at > to || (!l.x && !l.y)) continue; // (0,0) = no fix
    (trails[l.driver_number] ??= []).push([at, l.x, l.y]);
  }
  for (const tr of Object.values(trails)) tr.sort((a, b) => a[0] - b[0]);
  const lapsSoFar = laps.filter((l) => l.date_start && ms(l.date_start) <= t);
  const done = lapsSoFar.filter((l) => l.lap_duration != null && ms(l.date_start!) + l.lap_duration * 1000 <= t);

  // overall and personal best sectors → purple / green / yellow
  const sectorKeys = ["duration_sector_1", "duration_sector_2", "duration_sector_3"] as const;
  const bestOf = (ls: Lap[], k: (typeof sectorKeys)[number]) => Math.min(...ls.map((l) => l[k] ?? Infinity));
  const overall = sectorKeys.map((k) => bestOf(done, k));

  // retired / stopped (race): no new lap for 3 typical laps while the leader keeps lapping (a red flag stops everyone)
  const race = isRaceSession(session);
  const lastStart = new Map<number, number>();
  for (const l of lapsSoFar) lastStart.set(l.driver_number, Math.max(lastStart.get(l.driver_number) ?? 0, ms(l.date_start!)));
  const durs = done.map((l) => l.lap_duration!).sort((a, b) => a - b);
  const typical = (durs[durs.length >> 1] ?? 100) * 1000;
  const leaderLast = Math.max(0, ...lastStart.values());
  const isOut = (n: number) => {
    const s = lastStart.get(n);
    return race && s != null && leaderLast - s > 2 * typical && t - s > 3 * typical;
  };

  const tower: TowerRow[] = drivers.map((d) => {
    const mine = done.filter((l) => l.driver_number === d.driver_number);
    const last = mine.reduce<Lap | null>((a, l) => (!a || l.lap_number > a.lap_number ? l : a), null);
    const lap = Math.max(0, ...lapsSoFar.filter((l) => l.driver_number === d.driver_number).map((l) => l.lap_number)) || null;
    const stint = stints
      .filter((s) => s.driver_number === d.driver_number && lap != null && s.lap_start <= lap)
      .sort((a, b) => b.stint_number - a.stint_number)[0];
    const g = gaps.get(d.driver_number);
    const best = Math.min(...mine.map((l) => l.lap_duration ?? Infinity));
    return {
      driver_number: d.driver_number, acronym: d.name_acronym, name: d.full_name, team: d.team_name,
      colour: `#${d.team_colour || "888888"}`,
      position: pos.get(d.driver_number)?.position ?? null,
      gap: fmtGap(g?.gap_to_leader), interval: fmtGap(g?.interval),
      lap, lastLap: last?.lap_duration ?? null,
      bestLap: best === Infinity ? null : best,
      sectors: sectorKeys.map((k, i) => {
        const time = last?.[k] ?? null;
        const colour = time == null ? null : time <= overall[i] ? "purple" : time <= bestOf(mine, k) ? "green" : "yellow";
        return { time, colour };
      }),
      compound: stint?.compound ?? null,
      tyreAge: stint && lap != null ? (stint.tyre_age_at_start ?? 0) + lap - stint.lap_start : null,
      pits: stint ? stint.stint_number - 1 : 0,
      gapS: typeof g?.gap_to_leader === "number" ? g.gap_to_leader : pos.get(d.driver_number)?.position === 1 ? 0 : null,
      out: isOut(d.driver_number),
    };
  });
  tower.sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || (a.bestLap ?? 1e9) - (b.bestLap ?? 1e9));

  const rcSoFar = rc.filter((m) => ms(m.date) <= t).sort((a, b) => ms(a.date) - ms(b.date));
  const status = trackStatus(rcSoFar);

  let strat: LiveState["strategy"] = null;
  if (race && tower.some((r) => r.lap)) {
    const circuit = await circuitInfo(session).catch(() => ({ rotation: 0, corners: [] as Corner[] } as Awaited<ReturnType<typeof circuitInfo>>));
    const underSC = status === "SAFETY CAR" || status === "VSC";
    // shortcut: generic 22 s pit loss when MultiViewer has no figure for this circuit
    const greenLoss = circuit.pitLoss ?? 22;
    const pitLoss = underSC ? circuit.pitLossSC ?? greenLoss * 0.6 : greenLoss;
    // this session's measured tyre wear per compound; typical values until there are enough clean laps
    const measured = new Map(compoundSummary(stintDegradation(done, stints, neutralisedLaps(rcSoFar))).map((c) => [c.compound, c.deg]));
    const deg: Record<string, { value: number; measured: boolean }> = {};
    for (const c of new Set([...Object.keys(DEFAULT_DEG), ...measured.keys()])) {
      const m = measured.get(c);
      deg[c] = m != null && m >= 0.01 ? { value: m, measured: true } : { value: DEFAULT_DEG[c] ?? 0.05, measured: false };
    }
    const totalLaps = circuit.lapLength ? raceLaps(circuit.lapLength, /sprint/i.test(session.session_name) ? 100 : session.circuit_key === 22 ? 260 : 305) : null;
    const leaderLap = tower[0]?.lap ?? null;
    const lapsLeft = totalLaps != null && leaderLap != null ? Math.max(0, totalLaps - leaderLap) : null;
    const s = strategy(
      tower.filter((r) => r.position != null).map((r) => ({ n: r.driver_number, code: r.acronym, position: r.position!, gap: r.gapS, compound: r.compound, age: r.tyreAge, out: r.out })),
      { pitLoss, deg: Object.fromEntries(Object.entries(deg).map(([k, v]) => [k, v.value])), lapsLeft },
    );
    // under SC/VSC the pack is bunched and everyone's gap is artificial: no undercut/overcut hints
    strat = { pitLoss, underSC, totalLaps, lapsLeft, deg, rows: s.rows, threats: underSC ? [] : s.threats };
  }
  const acr = new Map(drivers.map((d) => [d.driver_number, d.name_acronym]));
  return {
    session, t: T, live, race, strategy: strat,
    status,
    weather: weather.filter((w) => ms(w.date) <= t).at(-1) ?? null,
    tower, trails,
    raceControl: rcSoFar.slice(-40).reverse(),
    radio: radio.filter((r) => ms(r.date) <= t).slice(-12).reverse().map((r) => ({ ...r, acronym: acr.get(r.driver_number) ?? String(r.driver_number) })),
    telemetry: driver
      ? car.filter((s) => ms(s.date) <= t && ms(s.date) > t - 40_000).map((s) => ({ t: (ms(s.date) - t) / 1000, speed: s.speed, throttle: s.throttle, brake: s.brake > 0 ? 100 : 0, gear: s.n_gear }))
      : null,
  };
}

export type Corner = { n: number; letter: string; x: number; y: number; angle: number; name?: string };

/** Corner numbers and the TV-broadcast map rotation from MultiViewer's circuit API (same x/y system as OpenF1 location). */
export async function circuitInfo(session: Pick<Session, "circuit_key" | "year">): Promise<{
  rotation: number; corners: Corner[]; pitLoss?: number; pitLossSC?: number; lapLength?: number;
}> {
  const res = await fetch(`https://api.multiviewer.app/api/v1/circuits/${session.circuit_key}/${session.year}`, {
    headers: { "User-Agent": "f1-site/0.1" }, next: { revalidate: 86400 },
  });
  if (!res.ok) return { rotation: 0, corners: [] }; // map still works without corner labels
  const j = await res.json();
  return {
    rotation: Number(j.rotation) || 0,
    pitLoss: Number(j.pitLoss?.normal) || undefined, // seconds lost driving through the pit lane under green
    pitLossSC: Number(j.pitLoss?.sc) || undefined, // …and under a safety car (the field is slower, so a stop costs less)
    // outline length in metres (MultiViewer x/y are in decimetres, like OpenF1 location)
    lapLength: Array.isArray(j.x) ? j.x.reduce((s: number, x: number, i: number) => (i ? s + Math.hypot(x - j.x[i - 1], j.y[i] - j.y[i - 1]) : 0), 0) / 10 || undefined : undefined,
    corners: (j.corners ?? []).map((c: { number: number; letter?: string; angle: number; trackPosition: { x: number; y: number } }) => ({
      n: c.number, letter: c.letter ?? "", x: c.trackPosition.x, y: c.trackPosition.y, angle: c.angle,
      name: cornerName(session.circuit_key, c.number),
    })),
  };
}

/** Circuit outline: one clean lap of location data from any driver (cached per session). */
export async function trackOutline(sessionKey: string): Promise<{ x: number; y: number }[]> {
  const session = await getSession(sessionKey);
  if (!session) return [];
  const laps = await openf1<Lap>("laps", { session_key: session.session_key }, cacheFor(session, 30));
  const lap = laps
    .filter((l) => l.date_start && l.lap_duration && !l.is_pit_out_lap && l.lap_number > 1)
    .sort((a, b) => a.lap_duration! - b.lap_duration!)[0];
  if (!lap) return [];
  const start = ms(lap.date_start!);
  const pts = await openf1<Location>(
    "location",
    {
      session_key: session.session_key, driver_number: lap.driver_number,
      "date>=": new Date(start).toISOString(), "date<=": new Date(start + lap.lap_duration! * 1000).toISOString(),
    },
    86400,
  );
  return pts.filter((p) => p.x || p.y).map((p) => ({ x: p.x, y: p.y }));
}
