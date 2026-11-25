// Corner-by-corner lap comparison and 2026 energy "clipping" detection (pure, unit-tested in corner-analysis.test.ts).
import type { TelPoint } from "./analysis";

type PathPt = { x: number; y: number; t: number };
type Corner = { n: number; letter?: string; name?: string; x: number; y: number };

export type CornerDriver = {
  minSpeed: number;
  brakeBefore: number | null; // metres before the corner where braking starts (null = no braking: flat out)
  throttleAfter: number | null; // metres after the corner where full throttle comes back (negative = before it)
  time: number; // seconds spent in this corner's zone
  delta: number; // vs the reference driver (+ = slower)
};
export type CornerRow = { n: number; label: string; name?: string; d: number; zone: [number, number]; drivers: CornerDriver[] };

/** Linear interpolation of time at distance d (points sorted by d). */
function timeAt(pts: TelPoint[], d: number) {
  let lo = 0, hi = pts.length - 1;
  if (d <= pts[0].d) return pts[0].t;
  if (d >= pts[hi].d) return pts[hi].t;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].d <= d) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi];
  return a.t + ((d - a.d) / (b.d - a.d || 1)) * (b.t - a.t);
}

/** Lap distance of each corner: nearest position sample → its time → distance travelled by then. */
export function cornerDistances(points: TelPoint[], path: PathPt[], corners: Corner[]) {
  return corners.map((c) => {
    let best = path[0], bd = Infinity;
    for (const p of path) { const dd = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (dd < bd) { bd = dd; best = p; } }
    const i = points.findIndex((p) => p.t >= best.t);
    return { ...c, d: points[Math.max(0, i)].d };
  }).sort((a, b) => a.d - b.d);
}

/**
 * Compare laps corner by corner. laps[0] is the reference (its path places the corners); other laps are scaled to its
 * length so the same distance means the same place on track. Each corner owns the track from halfway to the previous
 * corner to halfway to the next one.
 */
export const MERGE_WITHIN = 150; // corners closer than this (m), or sharing a name, are one complex (chicanes, esses)

export function cornerAnalysis(laps: TelPoint[][], refPath: PathPt[], corners: Corner[]): CornerRow[] {
  if (!laps.length || laps.some((l) => l.length < 20) || !corners.length) return [];
  const L = laps[0].at(-1)!.d;
  const scaled = laps.map((p) => { const k = L / (p.at(-1)!.d || 1); return p.map((q) => ({ ...q, d: q.d * k })); });
  const cd = cornerDistances(laps[0], refPath, corners);

  // group chicanes: a single braking zone and minimum speed only make sense for the whole complex
  const groups: (typeof cd)[] = [];
  for (const c of cd) {
    const g = groups.at(-1), prev = g?.at(-1);
    if (g && prev && ((c.name && c.name === prev.name) || c.d - prev.d < MERGE_WITHIN)) g.push(c);
    else groups.push([c]);
  }

  return groups.map((g, i) => {
    const entry = g[0], exit = g.at(-1)!;
    const from = i ? (groups[i - 1].at(-1)!.d + entry.d) / 2 : 0, to = i < groups.length - 1 ? (exit.d + groups[i + 1][0].d) / 2 : L;
    const drivers = scaled.map((pts) => {
      const idx = pts.map((_, j) => j).filter((j) => pts[j].d >= from && pts[j].d <= to);
      if (!idx.length) return { minSpeed: 0, brakeBefore: null, throttleAfter: null, time: 0, delta: 0 };
      const apex = idx.reduce((a, j) => (pts[j].speed < pts[a].speed ? j : a), idx[0]);
      // braking point = where the driver first brakes for this corner (or complex) before its slowest point; in a chicane
      // that's the big stop for the first part, not a later dab for the second
      const first = idx.find((j) => j <= apex && pts[j].brake);
      const brakeBefore = first != null ? entry.d - pts[first].d : null;
      const on = idx.find((j) => j >= apex && pts[j].throttle >= 98);
      return {
        minSpeed: pts[apex].speed, brakeBefore, throttleAfter: on != null ? pts[on].d - exit.d : null,
        time: timeAt(pts, to) - timeAt(pts, from), delta: 0,
      };
    });
    for (const d of drivers) d.delta = d.time - drivers[0].time;
    const label = `${entry.n}${entry.letter ?? ""}` + (g.length > 1 ? `–${exit.n}${exit.letter ?? ""}` : "");
    return { n: entry.n, label, name: entry.name, d: entry.d, zone: [from, to] as [number, number], drivers };
  });
}

export type Clip = { startD: number; endD: number; from: number; to: number; seconds: number };

/**
 * Energy "clipping": the car is flat out (full throttle, no brake) above `minSpeed` yet its speed stops rising and falls.
 * Under the 2026 rules this is the battery running out of deployment before the end of a straight. Gear-change blips
 * are filtered by needing `minSamples` consecutive samples and a drop of at least `minDrop` km/h.
 */
export function clippingEvents(pts: TelPoint[], minSpeed = 200, minDrop = 3, minSamples = 3): Clip[] {
  const out: Clip[] = [];
  const full = (p: TelPoint) => p.throttle >= 98 && !p.brake && !p.stale; // a frozen feed looks flat, not like clipping
  let s = -1;
  const close = (e: number) => {
    if (s >= 0 && e - s + 1 >= minSamples && pts[s].speed - pts[e].speed >= minDrop) {
      out.push({ startD: pts[s].d, endD: pts[e].d, from: pts[s].speed, to: pts[e].speed, seconds: pts[e].t - pts[s].t });
    }
    s = -1;
  };
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1];
    const flatAndFading = full(p) && full(q) && p.speed <= q.speed && q.speed >= minSpeed;
    if (flatAndFading) { if (s < 0) s = i - 1; }
    else if (s >= 0) close(i - 1);
  }
  if (s >= 0) close(pts.length - 1);
  return out;
}
