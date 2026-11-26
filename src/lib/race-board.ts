// Whole-field race charts for the Live canvas: gap to the leader per lap and the pit-stop list (pure, see race-board.test.ts).
import type { Lap, Pit, Stint } from "./openf1";

/** Each completed lap → every driver's gap to whoever finished that lap first (seconds). Laps finished after t are left out. */
export function gapsToLeader(laps: Lap[], t = Infinity): { lap: number; gaps: Record<number, number> }[] {
  const byLap = new Map<number, { n: number; end: number }[]>();
  for (const l of laps) {
    if (!l.date_start || !l.lap_duration) continue;
    const end = Date.parse(l.date_start) + l.lap_duration * 1000;
    if (end > t) continue;
    const row = byLap.get(l.lap_number) ?? [];
    row.push({ n: l.driver_number, end });
    byLap.set(l.lap_number, row);
  }
  return [...byLap].sort(([a], [b]) => a - b).map(([lap, row]) => {
    const first = Math.min(...row.map((r) => r.end));
    return { lap, gaps: Object.fromEntries(row.map((r) => [r.n, Math.round((r.end - first) / 10) / 100])) };
  });
}

export type AeroRow = { driver_number: number; top: number; i1: number | null; i2: number | null; best: number };

/**
 * Drag vs downforce per driver: fastest speed-trap reading (low drag) against best lap (downforce + everything else).
 * Out-laps and lap 1 are skipped; drivers without both numbers are left out.
 */
export function aeroEfficiency(laps: Lap[]): AeroRow[] {
  const by = new Map<number, AeroRow>();
  for (const l of laps) {
    if (l.is_pit_out_lap || l.lap_number <= 1 || !l.lap_duration) continue;
    const r = by.get(l.driver_number) ?? { driver_number: l.driver_number, top: 0, i1: null, i2: null, best: Infinity };
    r.top = Math.max(r.top, l.st_speed ?? 0);
    if (l.i1_speed) r.i1 = Math.max(r.i1 ?? 0, l.i1_speed);
    if (l.i2_speed) r.i2 = Math.max(r.i2 ?? 0, l.i2_speed);
    r.best = Math.min(r.best, l.lap_duration);
    by.set(l.driver_number, r);
  }
  return [...by.values()].filter((r) => r.top > 0 && Number.isFinite(r.best));
}

export type PitRow = { driver_number: number; lap: number; lane: number | null; stop: number | null; off: string | null; on: string | null; date: string };

/** Pit stops made by t, newest first; the k-th stop of a driver sits between his k-th and (k+1)-th stint. */
export function pitStops(pits: Pit[], stints: Stint[], t = Infinity): PitRow[] {
  const done = pits.filter((p) => Date.parse(p.date) <= t).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const count = new Map<number, number>();
  return done.map((p) => {
    const k = (count.get(p.driver_number) ?? 0) + 1;
    count.set(p.driver_number, k);
    const mine = stints.filter((s) => s.driver_number === p.driver_number).sort((a, b) => a.stint_number - b.stint_number);
    return {
      driver_number: p.driver_number, lap: p.lap_number, date: p.date,
      lane: p.pit_duration ?? null, stop: p.stop_duration ?? null,
      off: mine[k - 1]?.compound ?? null, on: mine[k]?.compound ?? null,
    };
  }).reverse();
}
