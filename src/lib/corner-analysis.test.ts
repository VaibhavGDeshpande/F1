import { test } from "node:test";
import assert from "node:assert/strict";
import { clippingEvents, cornerAnalysis } from "./corner-analysis.ts";
import type { TelPoint } from "./analysis.ts";

// A straight-line "lap" sampled every 0.1 s: flat out, one corner at 1000 m.
// The driver brakes `brakeAt` metres before it, slows to `vmin`, and is back on full throttle 50 m after it.
function lap(brakeAt: number, vmin: number): TelPoint[] {
  const pts: TelPoint[] = [];
  let d = 0, t = 0, v = 300;
  while (d < 2000) {
    const braking = d >= 1000 - brakeAt && d < 1000;
    const slow = d >= 1000 && d < 1050;
    if (braking) v = Math.max(vmin, v - 12);
    else if (slow) v = vmin;
    else v = Math.min(300, v + 4);
    pts.push({ t, d, speed: v, throttle: braking || slow ? 0 : 100, brake: braking ? 100 : 0, gear: 8, rpm: 11000 });
    d += (v / 3.6) * 0.1; t += 0.1;
  }
  return pts;
}
const pathOf = (pts: TelPoint[]) => pts.map((p) => ({ x: p.d, y: 0, t: p.t }));

test("corner by corner: braking point, minimum speed, power-on and time delta", () => {
  const ref = lap(120, 100), late = lap(90, 110); // later braking and more minimum speed = faster
  const [c] = cornerAnalysis([ref, late], pathOf(ref), [{ n: 1, name: "Test", x: 1000, y: 0 }]);
  assert.equal(c.label, "1");
  const [a, b] = c.drivers;
  assert.ok(Math.abs(a.brakeBefore! - 120) < 15, `ref brakes ~120 m before, got ${a.brakeBefore}`);
  assert.ok(b.brakeBefore! < a.brakeBefore!, "the other driver brakes later");
  assert.equal(a.minSpeed, 100);
  assert.equal(b.minSpeed, 110);
  assert.ok(a.throttleAfter! > 40 && a.throttleAfter! < 70);
  assert.equal(a.delta, 0);
  assert.ok(b.delta < 0, `faster through the corner, delta ${b.delta}`);
});

test("chicanes (same name or close together) become one row; brake flicker and a second dab don't move the braking point", () => {
  const ref = lap(120, 100);
  const flicker = ref.map((p, i) => (p.brake && i % 5 === 0 ? { ...p, brake: 0 } : p)); // brake signal drops out now and then
  // a second short brake application inside the chicane, after the first corner marker
  const dab = flicker.map((p) => (p.d > 1010 && p.d < 1030 ? { ...p, brake: 100, throttle: 0 } : p));
  const rows = cornerAnalysis([ref, dab], pathOf(ref), [
    { n: 1, name: "Chicane", x: 1000, y: 0 }, { n: 2, name: "Chicane", x: 1060, y: 0 }, { n: 3, x: 1500, y: 0 },
  ]);
  assert.deepEqual(rows.map((r) => r.label), ["1–2", "3"]);
  assert.ok(Math.abs(rows[0].drivers[1].brakeBefore! - rows[0].drivers[0].brakeBefore!) < 1, "flicker doesn't move the braking point");
});

test("clipping: speed falling at full throttle is flagged, gear-change blips and plateaus are not", () => {
  const p = (d: number, speed: number, throttle = 100, brake = 0): TelPoint => ({ t: d / 80, d, speed, throttle, brake, gear: 8, rpm: 11000 });
  const pts = [
    p(0, 280), p(80, 290), p(160, 289), p(240, 296), // one-sample upshift blip: ignored
    p(320, 305), p(400, 305), p(480, 305), // plateau at v-max: no drop, ignored
    p(560, 310), p(640, 308), p(720, 305), p(800, 301), p(880, 298), // flat out yet losing 12 km/h: clipping
    p(960, 250, 0, 100), // braking for the next corner
  ];
  const clips = clippingEvents(pts);
  assert.equal(clips.length, 1);
  assert.deepEqual([clips[0].from, clips[0].to, clips[0].startD, clips[0].endD], [310, 298, 560, 880]);
});
