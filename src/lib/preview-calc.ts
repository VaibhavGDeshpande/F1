// Pure maths for the weekend preview (no I/O; unit-tested in preview-calc.test.ts).
import type { TelPoint } from "./analysis";

export type CornerClass = "slow" | "medium" | "fast";
export type CornerSpeed = { n: number; label: string; name?: string; speed: number; cls: CornerClass };
export type TrackProfile = {
  lengthKm: number; avgSpeed: number; topSpeed: number; fullThrottlePct: number; brakingZones: number;
  corners: CornerSpeed[]; counts: Record<CornerClass, number>; downforce: "Low" | "Medium" | "High"; tags: string[];
};

// corner speed bands (minimum speed through the corner)
export const SLOW_BELOW = 125, FAST_ABOVE = 200;
export const classify = (kmh: number): CornerClass => (kmh < SLOW_BELOW ? "slow" : kmh > FAST_ABOVE ? "fast" : "medium");

/** Lap telemetry + corner positions → how the circuit behaves. */
export function trackProfile(
  points: TelPoint[], path: { x: number; y: number; t: number }[],
  corners: { n: number; letter?: string; name?: string; x: number; y: number }[],
  lapSeconds: number, street = false,
): TrackProfile | null {
  if (points.length < 50 || !lapSeconds) return null;
  const length = points.at(-1)!.d;
  let full = 0, total = 0, zones = 0, lastBrake = -Infinity;
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t;
    total += dt;
    if (points[i].throttle >= 98) full += dt;
    // a braking zone = brake goes on, at least 1.5 s after the previous one started
    if (points[i].brake && !points[i - 1].brake && points[i].t - lastBrake > 1.5) { zones++; lastBrake = points[i].t; }
  }
  const cs: CornerSpeed[] = corners.flatMap((c) => {
    let best = path[0], bd = Infinity;
    for (const p of path) { const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; best = p; } }
    if (!best) return [];
    const near = points.filter((p) => Math.abs(p.t - best.t) <= 2);
    if (!near.length) return [];
    const speed = Math.min(...near.map((p) => p.speed));
    return [{ n: c.n, label: `${c.n}${c.letter ?? ""}`, name: c.name, speed, cls: classify(speed) }];
  });
  const counts = { slow: 0, medium: 0, fast: 0 };
  for (const c of cs) counts[c.cls]++;
  const fullThrottlePct = total ? (full / total) * 100 : 0;
  const avgSpeed = (length / lapSeconds) * 3.6;
  const downforce = fullThrottlePct >= 72 ? "Low" : counts.slow + counts.medium >= 10 && fullThrottlePct < 62 ? "High" : "Medium";
  const tags = [
    street && "Street circuit",
    fullThrottlePct >= 70 && "Power-sensitive",
    avgSpeed >= 225 && "High-speed",
    (avgSpeed < 185 || counts.slow >= 6) && "Low-speed / twisty",
    zones >= 9 && "Heavy braking",
    counts.fast >= 6 && "Fast sweeping corners",
  ].filter((x): x is string => !!x);
  return {
    lengthKm: length / 1000, avgSpeed, topSpeed: Math.max(...points.map((p) => p.speed)), fullThrottlePct,
    brakingZones: zones, corners: cs, counts, downforce, tags,
  };
}

export type Signal = { key: string; label: string; weight: number; values: Map<string, number>; higherIsBetter: boolean };

/** Weighted blend of signals per team, each scaled 0–1 (1 = best team on that signal). Missing signals are skipped. */
export function favourites(signals: Signal[]): { team: string; score: number }[] {
  const used = signals.filter((s) => s.values.size > 1);
  const teams = new Set(used.flatMap((s) => [...s.values.keys()]));
  const out = [...teams].map((team) => {
    let sum = 0, w = 0;
    for (const s of used) {
      const v = s.values.get(team);
      if (v == null) continue;
      const vals = [...s.values.values()], lo = Math.min(...vals), hi = Math.max(...vals);
      const norm = hi === lo ? 1 : (v - lo) / (hi - lo);
      sum += s.weight * (s.higherIsBetter ? norm : 1 - norm);
      w += s.weight;
    }
    return { team, score: w ? sum / w : 0 };
  });
  return out.sort((a, b) => b.score - a.score);
}
