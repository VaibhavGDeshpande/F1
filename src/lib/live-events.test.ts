import { test } from "node:test";
import assert from "node:assert/strict";
import { liveEvents, type Snap } from "./live-events.ts";

const row = (n: number, acronym: string, bestLap: number | null, pits = 0, out = false) => ({ driver_number: n, acronym, bestLap, pits, out, compound: "HARD" });
const snap = (t: number, over: Partial<Snap> = {}): Snap => ({ t, status: "GREEN", race: true, raceControl: [], tower: [row(1, "AAA", 90), row(2, "BBB", 91)], ...over });

test("no events on first load or a scrub jump", () => {
  assert.deepEqual(liveEvents(null, snap(1000)), []);
  assert.deepEqual(liveEvents(snap(0), snap(500_000, { status: "SAFETY CAR" })), []);
});

test("safety car, green flag, fastest lap, pit stop and retirement", () => {
  const sc = liveEvents(snap(0), snap(4000, { status: "SAFETY CAR" }));
  assert.deepEqual(sc.map((e) => e.title), ["Safety car deployed"]);
  assert.deepEqual(liveEvents(snap(0, { status: "SAFETY CAR" }), snap(4000)).map((e) => e.title), ["Green flag"]);

  const ev = liveEvents(snap(0), snap(4000, { tower: [row(1, "AAA", 90, 1), row(2, "BBB", 89.5, 0, true)] }));
  assert.deepEqual(ev.map((e) => e.title), ["Fastest lap", "Retirement", "Pit stop"]);
  assert.equal(ev[0].body, "BBB 1:29.500");
  assert.equal(ev[2].body, "AAA pits (stop 1) — now on hard");
});

test("several pit stops in one update become one toast", () => {
  const before = snap(0, { tower: [row(1, "AAA", 90), row(2, "BBB", 91), row(3, "CCC", 92)] });
  const ev = liveEvents(before, snap(4000, { tower: [row(1, "AAA", 90, 1), row(2, "BBB", 91, 1), row(3, "CCC", 92, 1)] }));
  assert.deepEqual(ev.map((e) => [e.title, e.body]), [["3 pit stops", "AAA, BBB, CCC pitted"]]);
});

test("stewards messages only inside the update window; no pit toasts outside races", () => {
  const rc = (date: string, message: string) => ({ date, message, driver_number: null, lap_number: 5, category: "Other", flag: null, scope: null, sector: null });
  const cur = snap(Date.parse("2026-01-01T00:00:10Z"), {
    race: false, raceControl: [rc("2026-01-01T00:00:05Z", "FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 1"), rc("2025-12-31T23:59:00Z", "OLD NOTED")],
    tower: [row(1, "AAA", 90, 3), row(2, "BBB", 91)],
  });
  const ev = liveEvents(snap(Date.parse("2026-01-01T00:00:00Z")), cur);
  assert.deepEqual(ev.map((e) => [e.tone, e.title]), [["red", "Race control · Lap 5"]]);
});
