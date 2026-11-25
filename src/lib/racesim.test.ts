import { test } from "node:test";
import assert from "node:assert/strict";
import { monteCarlo, optimise, pitWindows, stintCosts, type SimInput } from "./racesim.ts";

const tyres = {
  SOFT: { pace: 0, deg: 0.1, life: 15 },
  MEDIUM: { pace: 0.4, deg: 0.05, life: 30 },
  HARD: { pace: 0.8, deg: 0.03, life: 45 },
};
const base: SimInput = { laps: 50, pitLoss: 22, pitLossSC: 12, scChance: 0, tyres };

test("stint cost includes wear and the cliff", () => {
  const c = stintCosts(tyres, 20);
  assert.ok(Math.abs(c.SOFT[3] - (0 + 0.1 + 0.2)) < 1e-12); // ages 0,1,2
  // lap 17 of a soft stint is age 16: one lap past its 15-lap life → +0.25
  assert.ok(Math.abs(c.SOFT[17] - c.SOFT[16] - (1.6 + 0.25)) < 1e-12);
});

test("expensive pit stops favour one stop, cheap stops and high wear favour two", () => {
  const one = optimise(base);
  assert.equal(one[0].stops.length, 1);
  assert.ok(one.every((s) => new Set(s.seq).size >= 2), "every strategy uses two compounds");
  const two = optimise({ ...base, pitLoss: 8, tyres: { SOFT: { pace: 0, deg: 0.3, life: 10 }, MEDIUM: { pace: 0.4, deg: 0.2, life: 15 }, HARD: { pace: 0.8, deg: 0.12, life: 20 } } });
  assert.equal(two[0].stops.length, 2);
});

test("a per-set lap limit forces more stops and is never broken", () => {
  const limited = { ...base, laps: 57, maxStint: 27 };
  const r = optimise(limited);
  assert.ok(r.length > 0);
  assert.ok(r.every((s) => s.stops.length >= 2), "57 laps can't be done in two 27-lap stints");
  for (const s of r) [0, ...s.stops, 57].forEach((x, i, a) => { if (i) assert.ok(x - a[i - 1] <= 27, `${s.seq} ${s.stops}`); });
  const mc = monteCarlo({ ...limited, scChance: 0.9 }, r.slice(0, 3), 300);
  assert.ok(Math.abs(mc.reduce((t, x) => t + x.winPct, 0) - 100) < 1e-9);
});

test("pit window brackets the optimal stop lap", () => {
  const s = optimise(base)[0];
  const [[from, to]] = pitWindows(base, s);
  assert.ok(from <= s.stops[0] && s.stops[0] <= to && to - from >= 2);
});

test("monte carlo: no safety cars matches the optimiser; safety cars make stops cheaper", () => {
  const strats = optimise(base).slice(0, 4);
  const calm = monteCarlo(base, strats, 200);
  assert.equal(calm[0].winPct, 100);
  assert.ok(Math.abs(calm[0].p10) < 1e-9);
  assert.equal(calm[0].stops.join(), strats[0].stops.join());
  const chaotic = monteCarlo({ ...base, scChance: 0.95 }, strats, 500);
  assert.ok(chaotic.some((r) => r.scStopPct > 50), "most races offer a cheap stop");
  assert.ok(Math.abs(chaotic.reduce((s, r) => s + r.winPct, 0) - 100) < 1e-9);
});
