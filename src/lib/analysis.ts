// Pure analysis helpers (no I/O): tyre degradation, neutralised laps, telemetry distance + lap delta.
import type { CarData, Lap, RaceControl, Stint } from "./openf1.ts";

// shortcut: one fixed fuel-burn effect for every car/track (~1.7 kg/lap × ~0.035 s/kg). Teams don't publish fuel
// loads, so all degradation numbers are estimates; replace with a per-track value if we ever get better data.
export const FUEL_EFFECT_S_PER_LAP = 0.06;

/** Laps run under Safety Car, VSC or red flag (from race control messages). */
export function neutralisedLaps(rc: RaceControl[]): Set<number> {
  const out = new Set<number>();
  let start: number | null = null;
  for (const m of [...rc].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    if (m.lap_number == null) continue;
    const msg = m.message.toUpperCase();
    if (/SAFETY CAR DEPLOYED|RED FLAG/.test(msg) || m.flag === "RED") {
      start ??= m.lap_number;
    } else if (start != null && (/SAFETY CAR IN THIS LAP|SAFETY CAR ENDING|VSC ENDING|GREEN LIGHT/.test(msg) || m.flag === "GREEN")) {
      for (let l = start; l <= m.lap_number + 1; l++) out.add(l); // +1: restart lap is not representative either
      start = null;
    }
  }
  if (start != null) out.add(start);
  return out;
}

export type StintDeg = {
  driver_number: number; stint_number: number; compound: string; laps: number;
  slope: number; // seconds lost per lap of tyre age (fuel-corrected)
  pace: number; // mean raw lap time of the clean laps
  points: { age: number; time: number; lap: number }[]; // time = fuel-corrected lap time
};

function linreg(pts: { x: number; y: number }[]) {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
  const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / den;
  return { slope, intercept: my - slope * mx };
}

/**
 * Degradation per stint. Clean laps only: no lap 1, no pit-out / in-laps, no SC/VSC laps, and nothing slower than
 * 107% of the stint's best (drops cool-down laps in practice and traffic-heavy laps). Needs >= minLaps clean laps.
 */
export function stintDegradation(laps: Lap[], stints: Stint[], neutral = new Set<number>(), minLaps = 5): StintDeg[] {
  const lastStint = new Map<number, number>();
  for (const s of stints) lastStint.set(s.driver_number, Math.max(lastStint.get(s.driver_number) ?? 0, s.stint_number));
  const out: StintDeg[] = [];
  for (const s of stints) {
    if (!s.compound) continue;
    const inLap = s.stint_number < (lastStint.get(s.driver_number) ?? 0) ? s.lap_end : -1;
    const cand = laps.filter(
      (l) => l.driver_number === s.driver_number && l.lap_number >= s.lap_start && l.lap_number <= s.lap_end &&
        l.lap_duration != null && !l.is_pit_out_lap && l.lap_number > 1 && l.lap_number !== inLap && !neutral.has(l.lap_number),
    );
    if (cand.length < minLaps) continue;
    const best = Math.min(...cand.map((l) => l.lap_duration!));
    const clean = cand.filter((l) => l.lap_duration! <= best * 1.07);
    if (clean.length < minLaps) continue;
    const points = clean.map((l) => ({
      lap: l.lap_number,
      age: (s.tyre_age_at_start ?? 0) + (l.lap_number - s.lap_start),
      time: l.lap_duration! + FUEL_EFFECT_S_PER_LAP * (l.lap_number - 1),
    }));
    const fit = linreg(points.map((p) => ({ x: p.age, y: p.time })));
    if (!fit) continue;
    out.push({
      driver_number: s.driver_number, stint_number: s.stint_number, compound: s.compound, laps: clean.length,
      slope: fit.slope, pace: clean.reduce((t, l) => t + l.lap_duration!, 0) / clean.length, points,
    });
  }
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export type CompoundSummary = { compound: string; stints: number; laps: number; deg: number; pace: number };

export function compoundSummary(degs: StintDeg[]): CompoundSummary[] {
  const by = new Map<string, StintDeg[]>();
  for (const d of degs) by.set(d.compound, [...(by.get(d.compound) ?? []), d]);
  return [...by].map(([compound, ds]) => ({
    compound, stints: ds.length, laps: ds.reduce((t, d) => t + d.laps, 0),
    deg: median(ds.map((d) => d.slope)), pace: median(ds.map((d) => d.pace)),
  }));
}

export type TelPoint = { t: number; d: number; speed: number; throttle: number; brake: number; gear: number; rpm: number };

/** Car data samples → points with time since lap start (s) and distance (m, integrated from speed). */
export function withDistance(car: CarData[], lapStart: string): TelPoint[] {
  const t0 = Date.parse(lapStart);
  let d = 0;
  return car.map((c, i) => {
    if (i > 0) d += (((car[i - 1].speed + c.speed) / 2) / 3.6) * ((Date.parse(c.date) - Date.parse(car[i - 1].date)) / 1000);
    return { t: (Date.parse(c.date) - t0) / 1000, d, speed: c.speed, throttle: c.throttle, brake: c.brake > 0 ? 100 : 0, gear: c.n_gear, rpm: c.rpm };
  });
}

/** Time delta of lap B vs lap A along A's distance (positive = B slower). B's distance is scaled to A's length. */
export function deltaTrace(a: TelPoint[], b: TelPoint[]): { d: number; delta: number }[] {
  if (a.length < 2 || b.length < 2) return [];
  const scale = a[a.length - 1].d / (b[b.length - 1].d || 1);
  const bd = b.map((p) => ({ d: p.d * scale, t: p.t }));
  const out: { d: number; delta: number }[] = [];
  let j = 0;
  for (const p of a) {
    while (j < bd.length - 2 && bd[j + 1].d < p.d) j++;
    const p0 = bd[j], p1 = bd[j + 1];
    const f = p1.d === p0.d ? 0 : Math.min(1, Math.max(0, (p.d - p0.d) / (p1.d - p0.d)));
    out.push({ d: p.d, delta: p0.t + f * (p1.t - p0.t) - p.t });
  }
  // samples don't start exactly on the line, so align both laps to zero at the start
  const z = out[0].delta;
  return out.map((p) => ({ d: p.d, delta: p.delta - z }));
}

/** One lap as [x, y, elevation, km/h] per position sample (speed = last car-data sample at or before it), for the 3D track. */
export function lapModel(points: TelPoint[], path: { x: number; y: number; z?: number; t: number }[]): [number, number, number, number][] {
  let j = 0;
  return path.map((q) => {
    while (j < points.length - 1 && points[j + 1].t <= q.t) j++;
    return [q.x, q.y, q.z ?? 0, points[j]?.speed ?? 0];
  });
}

/** Position on a time-sorted [ms, x, y] trail at time t: linear interpolation, clamped to the ends. */
export function trailAt(trail: [number, number, number][], t: number): { x: number; y: number } | null {
  if (!trail.length) return null;
  let lo = 0, hi = trail.length - 1;
  if (t <= trail[0][0]) return { x: trail[0][1], y: trail[0][2] };
  if (t >= trail[hi][0]) return { x: trail[hi][1], y: trail[hi][2] };
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (trail[mid][0] <= t) lo = mid; else hi = mid;
  }
  const [ta, xa, ya] = trail[lo], [tb, xb, yb] = trail[hi];
  const f = (t - ta) / (tb - ta || 1);
  return { x: xa + f * (xb - xa), y: ya + f * (yb - ya) };
}

export const fmtLap =(s: number | null | undefined) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  return m ? `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}` : s.toFixed(3);
};
