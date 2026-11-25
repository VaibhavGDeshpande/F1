import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, favourites, trackProfile } from "./preview-calc.ts";
import type { TelPoint } from "./analysis.ts";

test("corner speed bands", () => {
  assert.equal(classify(80), "slow");
  assert.equal(classify(160), "medium");
  assert.equal(classify(260), "fast");
});

test("track profile from a synthetic lap", () => {
  // 100 s lap sampled every 0.25 s: flat out except two 5 s braking zones at t=20 and t=60 (speed drops to 90 km/h)
  const pts: TelPoint[] = [];
  let d = 0;
  for (let t = 0; t <= 100; t += 0.25) {
    const braking = (t >= 20 && t < 25) || (t >= 60 && t < 65);
    const speed = braking ? 90 : 300;
    if (pts.length) d += (speed / 3.6) * 0.25;
    pts.push({ t, d, speed, throttle: braking ? 0 : 100, brake: braking ? 100 : 0, gear: 8, rpm: 11000 });
  }
  const path = pts.map((p) => ({ x: p.t * 10, y: 0, t: p.t }));
  const corners = [{ n: 1, x: 220, y: 0 }, { n: 2, x: 620, y: 0 }, { n: 3, x: 900, y: 0 }];
  const p = trackProfile(pts, path, corners, 100)!;
  assert.equal(p.brakingZones, 2);
  assert.ok(Math.abs(p.fullThrottlePct - 90) < 1, `full throttle ${p.fullThrottlePct}`);
  assert.deepEqual(p.corners.map((c) => c.cls), ["slow", "slow", "fast"]);
  assert.equal(p.topSpeed, 300);
  assert.equal(p.downforce, "Low");
  assert.ok(p.tags.includes("Power-sensitive"));
});

test("favourites blends signals and skips missing ones", () => {
  const r = favourites([
    { key: "form", label: "Form", weight: 0.5, higherIsBetter: true, values: new Map([["a", 100], ["b", 50], ["c", 0]]) },
    { key: "pace", label: "Pace", weight: 0.5, higherIsBetter: false, values: new Map([["a", 0.5], ["b", 0], ["c", 1]]) },
    { key: "empty", label: "None", weight: 1, higherIsBetter: true, values: new Map() },
  ]);
  assert.deepEqual(r.map((x) => x.team), ["a", "b", "c"]);
  assert.equal(r[0].score, 0.75);
});
