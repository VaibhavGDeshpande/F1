// Weekend preview: how the circuit behaves (from a real pole lap) and which teams look strongest (form, history, pace).
import { lapModel } from "./analysis";
import { constructorStandingsAfter, circuitRace, seasonSchedule } from "./jolpica";
import { circuitInfo } from "./live";
import { teamSlug } from "./media";
import { cacheFor, openf1, type Driver, type Lap, type Meeting, type Session } from "./openf1";
import { favourites, trackProfile, type TrackProfile } from "./preview-calc";
import { lapTelemetry } from "./session";

const DAY = 86400_000;
type Ranked = { slug: string; name: string; value: number }[];
export type Preview = {
  profile: (TrackProfile & {
    pitLoss?: number; ref: { year: number; driver: string; team: string; time: number };
    model: [number, number, number, number][]; // [x, y, elevation, km/h] along the lap, for the 3D track
  }) | null;
  form: { rounds: number; list: Ranked } | null;
  history: { years: number[]; list: Ranked } | null;
  pace: { session: string; list: Ranked } | null;
  favourites: { slug: string; name: string; score: number }[];
};

/** Pole lap of this year's qualifying here if it has run, else the most recent earlier one at this circuit. */
async function referenceLap(m: Meeting) {
  for (const year of [m.year, m.year - 1, m.year - 2]) {
    const q = (await openf1<Session>("sessions", { circuit_key: m.circuit_key, year, session_name: "Qualifying" }, 3600))
      .find((s) => Date.parse(s.date_end) < Date.now() && !s.is_cancelled);
    if (!q) continue;
    const laps = await openf1<Lap>("laps", { session_key: q.session_key }, cacheFor(q, 600));
    const lap = laps.filter((l) => l.lap_duration).sort((a, b) => a.lap_duration! - b.lap_duration!)[0];
    if (!lap) continue;
    const d = (await openf1<Driver>("drivers", { session_key: q.session_key }, 86400)).find((x) => x.driver_number === lap.driver_number);
    return { session: q, lap, driver: d };
  }
  return null;
}

async function profileFor(m: Meeting): Promise<Preview["profile"]> {
  const ref = await referenceLap(m);
  if (!ref) return null;
  const [tel, circuit] = await Promise.all([
    lapTelemetry(String(ref.session.session_key), ref.lap.driver_number, ref.lap.lap_number),
    circuitInfo({ circuit_key: m.circuit_key, year: ref.session.year }).catch(() => ({ rotation: 0, corners: [], pitLoss: undefined })),
  ]);
  if (!tel) return null;
  const p = trackProfile(tel.points, tel.path, circuit.corners, ref.lap.lap_duration!, /street/i.test(m.circuit_type ?? ""));
  const model = lapModel(tel.points, tel.path);
  return p && {
    ...p, pitLoss: circuit.pitLoss, model,
    ref: { year: ref.session.year, driver: ref.driver?.name_acronym ?? String(ref.lap.driver_number), team: ref.driver?.team_name ?? "", time: ref.lap.lap_duration! },
  };
}

const ranked = (m: Map<string, number>, names: Map<string, string>, higherIsBetter = true): Ranked =>
  [...m].map(([slug, value]) => ({ slug, name: names.get(slug) ?? slug, value })).sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));

export async function weekendPreview(m: Meeting, sessions: Session[]): Promise<Preview> {
  const names = new Map<string, string>(); // team slug → current display name
  const name = (n: string) => { const s = teamSlug(n) ?? n; if (!names.has(s)) names.set(s, n); return s; };

  // form: constructor points over the last 5 rounds before this weekend
  const start = Date.parse(m.date_start);
  const schedule = await seasonSchedule(m.year).catch(() => []);
  const lastRound = Math.max(0, ...schedule.filter((r) => Date.parse(r.date) < start - DAY).map((r) => Number(r.round)));
  const rounds = Math.min(5, lastRound);
  const form = new Map<string, number>();
  if (lastRound > 0) {
    const [now, before] = await Promise.all([
      constructorStandingsAfter(m.year, lastRound),
      lastRound > rounds ? constructorStandingsAfter(m.year, lastRound - rounds) : Promise.resolve([]),
    ]).catch(() => [[], []]);
    for (const s of now) {
      const prev = before.find((b) => b.Constructor.constructorId === s.Constructor.constructorId);
      form.set(name(s.Constructor.name), Number(s.points) - Number(prev?.points ?? 0));
    }
  }

  // history: race points at this circuit in the previous 3 seasons (team names normalised, e.g. Sauber → Audi)
  const race = schedule.find((r) => Math.abs(Date.parse(r.date) - start) < 5 * DAY);
  const history = new Map<string, number>(), years: number[] = [];
  if (race) {
    for (const y of [m.year - 1, m.year - 2, m.year - 3]) {
      const r = await circuitRace(y, race.Circuit.circuitId).catch(() => null);
      if (!r?.Results) continue;
      years.push(y);
      for (const res of r.Results) {
        const s = teamSlug(res.Constructor.name) ?? res.Constructor.name;
        history.set(s, (history.get(s) ?? 0) + Number(res.points));
      }
    }
  }

  // pace: each team's best lap in the latest finished session of this weekend, as seconds off the fastest team
  const latest = sessions.filter((s) => !s.is_cancelled && Date.parse(s.date_end) < Date.now()).at(-1);
  const pace = new Map<string, number>();
  if (latest) {
    const [laps, drivers] = await Promise.all([
      openf1<Lap>("laps", { session_key: latest.session_key }, cacheFor(latest, 60)),
      openf1<Driver>("drivers", { session_key: latest.session_key }, cacheFor(latest, 300)),
    ]).catch(() => [[], []] as [Lap[], Driver[]]);
    for (const l of laps) {
      const d = drivers.find((x) => x.driver_number === l.driver_number);
      if (!d || !l.lap_duration || l.is_pit_out_lap) continue;
      const s = name(d.team_name);
      pace.set(s, Math.min(pace.get(s) ?? Infinity, l.lap_duration));
    }
    const best = Math.min(...pace.values());
    for (const [k, v] of pace) pace.set(k, v - best);
  }

  const fav = favourites([
    { key: "pace", label: "Weekend pace", weight: 0.45, higherIsBetter: false, values: pace },
    { key: "form", label: "Recent form", weight: 0.35, higherIsBetter: true, values: form },
    { key: "history", label: "Track history", weight: 0.2, higherIsBetter: true, values: history },
  ]).filter((f) => names.has(f.team) || form.has(f.team)); // only teams on this year's grid

  return {
    profile: await profileFor(m).catch((e) => { console.error("track profile failed", e); return null; }),
    form: form.size ? { rounds, list: ranked(form, names) } : null,
    // teams that no longer exist (no current name) are left out of the history list
    history: history.size ? { years, list: ranked(history, names).filter((x) => !names.size || names.has(x.slug)) } : null,
    pace: pace.size ? { session: latest!.session_name, list: ranked(pace, names, false) } : null,
    favourites: fav.map((f) => ({ slug: f.team, name: names.get(f.team) ?? f.team, score: f.score })),
  };
}
