import { test } from "node:test";
import assert from "node:assert/strict";
import { gapsToLeader, pitStops } from "./race-board.ts";
import type { Lap, Pit, Stint } from "./openf1.ts";

const T0 = Date.parse("2026-11-22T04:00:00Z");
const lap = (n: number, lapNo: number, startS: number, dur: number) =>
  ({ driver_number: n, lap_number: lapNo, date_start: new Date(T0 + startS * 1000).toISOString(), lap_duration: dur, is_pit_out_lap: false }) as Lap;

test("gap to leader per lap, and laps not finished by t are left out", () => {
  const laps = [lap(1, 1, 0, 90), lap(2, 1, 0.5, 91), lap(1, 2, 90, 90), lap(2, 2, 91.5, 89)];
  assert.deepEqual(gapsToLeader(laps), [{ lap: 1, gaps: { 1: 0, 2: 1.5 } }, { lap: 2, gaps: { 1: 0, 2: 0.5 } }]);
  assert.deepEqual(gapsToLeader(laps, T0 + 180_000), [{ lap: 1, gaps: { 1: 0, 2: 1.5 } }, { lap: 2, gaps: { 1: 0 } }]);
});

test("pit stops pair with the stints either side, newest first", () => {
  const stints = [
    { driver_number: 1, stint_number: 1, compound: "MEDIUM" }, { driver_number: 1, stint_number: 2, compound: "HARD" },
    { driver_number: 1, stint_number: 3, compound: "SOFT" },
  ] as Stint[];
  const pits = [
    { driver_number: 1, lap_number: 30, date: "2026-11-22T05:00:00Z", pit_duration: 21.2, stop_duration: 2.4 },
    { driver_number: 1, lap_number: 15, date: "2026-11-22T04:30:00Z", pit_duration: 22.0, stop_duration: null },
  ] as Pit[];
  const rows = pitStops(pits, stints);
  assert.deepEqual(rows.map((r) => [r.lap, r.off, r.on]), [[30, "HARD", "SOFT"], [15, "MEDIUM", "HARD"]]);
  assert.equal(pitStops(pits, stints, Date.parse("2026-11-22T04:45:00Z")).length, 1);
});
