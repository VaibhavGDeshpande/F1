import { test } from "node:test";
import assert from "node:assert/strict";
import { deltaTrace, fixFrozen, FUEL_EFFECT_S_PER_LAP, neutralisedLaps, stintDegradation, trailAt, withDistance } from "./analysis.ts";

test("trailAt interpolates between samples and clamps outside them", () => {
  const tr: [number, number, number][] = [[1000, 0, 0], [2000, 100, 50], [3000, 100, 150]];
  assert.deepEqual(trailAt(tr, 1500), { x: 50, y: 25 });
  assert.deepEqual(trailAt(tr, 2500), { x: 100, y: 100 });
  assert.deepEqual(trailAt(tr, 0), { x: 0, y: 0 });
  assert.deepEqual(trailAt(tr, 9000), { x: 100, y: 150 });
  assert.equal(trailAt([], 1), null);
});
import type { Lap, RaceControl, Stint } from "./openf1.ts";

const lap = (n: number, t: number | null, out = false): Lap => ({
  driver_number: 1, lap_number: n, date_start: null, lap_duration: t, duration_sector_1: null, duration_sector_2: null,
  duration_sector_3: null, is_pit_out_lap: out, st_speed: null,
});

test("degradation slope recovers 0.1 s/lap after fuel correction and drops dirty laps", () => {
  // true tyre loss 0.1 s/lap, fuel makes each lap FUEL_EFFECT faster
  const laps = [lap(1, 100)];
  for (let n = 2; n <= 12; n++) laps.push(lap(n, 90 + 0.1 * (n - 2) - FUEL_EFFECT_S_PER_LAP * (n - 1)));
  laps[5] = lap(6, 130); // traffic / cool-down lap
  laps.push(lap(13, 110)); // in-lap
  laps.push(lap(14, 120, true)); // out-lap of stint 2
  const stints: Stint[] = [
    { driver_number: 1, stint_number: 1, lap_start: 1, lap_end: 13, compound: "MEDIUM", tyre_age_at_start: 0 },
    { driver_number: 1, stint_number: 2, lap_start: 14, lap_end: 14, compound: "HARD", tyre_age_at_start: 0 },
  ];
  const [d] = stintDegradation(laps, stints);
  assert.equal(d.compound, "MEDIUM");
  assert.equal(d.laps, 10); // laps 2–12 minus lap 6
  assert.ok(Math.abs(d.slope - 0.1) < 1e-9, `slope ${d.slope}`);
});

test("SC / VSC laps are marked neutralised", () => {
  const rc = (lap: number, message: string, flag: string | null = null): RaceControl => ({
    date: `2026-01-01T00:${String(lap).padStart(2, "0")}:00Z`, driver_number: null, lap_number: lap, category: "SafetyCar",
    flag, scope: null, sector: null, message,
  });
  const n = neutralisedLaps([rc(10, "SAFETY CAR DEPLOYED"), rc(13, "SAFETY CAR IN THIS LAP")]);
  assert.deepEqual([...n], [10, 11, 12, 13, 14]);
});

test("distance integration and lap delta", () => {
  const car = (s: number, speed: number) => ({ date: new Date(s * 1000).toISOString(), driver_number: 1, speed, throttle: 100, brake: 0, n_gear: 8, rpm: 11000 });
  const a = withDistance([car(0, 360), car(1, 360), car(2, 360)], new Date(0).toISOString());
  assert.equal(a[2].d, 200); // 100 m/s for 2 s
  const b = withDistance([car(0, 180), car(2, 180), car(4, 180)], new Date(0).toISOString()); // half the speed
  const delta = deltaTrace(a, b);
  assert.equal(delta.at(-1)!.delta, 2); // B is 2 s slower over the lap
});

test("fixFrozen: a frozen speed feed gets its distance from the GPS path", () => {
  // car really drives 50 m/s for 10 s; the feed sticks at 20 m/s (72 km/h) from t=3 to t=7
  const pts = Array.from({ length: 11 }, (_, t) => ({ t, d: 0, speed: t >= 3 && t <= 7 ? 72 : 180 + t, throttle: 100, brake: 0, gear: 7, rpm: t >= 3 && t <= 7 ? 9000 : 10000 + t }));
  for (let i = 1; i < pts.length; i++) pts[i].d = pts[i - 1].d + ((pts[i - 1].speed + pts[i].speed) / 2 / 3.6);
  const path = Array.from({ length: 11 }, (_, t) => ({ t, x: t * 500, y: 0 })); // 50 m per second, in decimetres
  const { points, frozen } = fixFrozen(pts, path);
  assert.ok(frozen >= 4);
  assert.ok(Math.abs(points.at(-1)!.d - pts.at(-1)!.d) > 50); // distance corrected upwards
  assert.ok(points.at(-1)!.d > 490 && points.at(-1)!.d < 520, `got ${points.at(-1)!.d}`);
  const healthy = fixFrozen(pts.map((p) => ({ ...p, rpm: p.rpm + p.t })), path); // nothing frozen: untouched
  assert.equal(healthy.frozen, 0);
});

test("fixFrozen: when the GPS froze too, the lap length fills the gap", () => {
  const pts = Array.from({ length: 11 }, (_, t) => ({ t, d: 0, speed: t >= 3 && t <= 7 ? 72 : 180, throttle: 100, brake: 0, gear: 7, rpm: t >= 3 && t <= 7 ? 9000 : 10000 + t }));
  for (let i = 1; i < pts.length; i++) pts[i].d = pts[i - 1].d + ((pts[i - 1].speed + pts[i].speed) / 2 / 3.6);
  const path = Array.from({ length: 11 }, (_, t) => ({ t, x: (t <= 3 ? t : t >= 8 ? t - 5 : 3) * 500, y: 0 })); // GPS stuck from 3 to 8
  const { points } = fixFrozen(pts, path, 500);
  assert.ok(Math.abs(points.at(-1)!.d - 500) < 1, `got ${points.at(-1)!.d}`);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].d >= points[i - 1].d); // never goes backwards
});
