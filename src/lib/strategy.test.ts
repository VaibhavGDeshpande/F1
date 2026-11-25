import { test } from "node:test";
import assert from "node:assert/strict";
import { battleGaps, raceLaps, strategy, trend } from "./strategy.ts";
import type { Lap } from "./openf1.ts";

const row = (n: number, code: string, position: number, gap: number | null, compound = "MEDIUM", age = 10) => ({ n, code, position, gap, compound, age });

test("pit rejoin position, car ahead and car behind", () => {
  const { rows } = strategy(
    [row(1, "AAA", 1, 0), row(2, "BBB", 2, 5), row(3, "CCC", 3, 12), row(4, "DDD", 4, 30), row(5, "EEE", 5, null)],
    { pitLoss: 20, deg: { MEDIUM: 0.05 }, lapsLeft: 30 },
  );
  const b = rows.find((r) => r.code === "BBB")!;
  // BBB at +5 pits → +25: behind CCC (+12), ahead of DDD (+30)
  assert.deepEqual(b.rejoin, { position: 3, ahead: { code: "CCC", gap: 13 }, behind: { code: "DDD", gap: 5 } });
  assert.equal(b.tyreLoss, 0.5); // 0.05 s/lap × 10 laps
  assert.equal(b.payback, 40); // 20 s ÷ 0.5 s/lap
  assert.equal(b.windowOpen, false); // 40 laps to pay back, only 30 left
  assert.equal(rows.find((r) => r.code === "EEE")!.rejoin, null); // lapped: no numeric gap
});

test("undercut and overcut threats between neighbours", () => {
  const { threats } = strategy(
    [row(1, "AAA", 1, 0, "SOFT", 20), row(2, "BBB", 2, 1.0, "SOFT", 3), row(3, "CCC", 3, 10, "HARD", 9), row(4, "DDD", 4, 11, "HARD", 9),
      row(5, "EEE", 5, 30, "HARD", 1), row(6, "FFF", 6, 31, "HARD", 1)], // EEE/FFF just pitted: no overcut hint
    { pitLoss: 20, deg: {}, lapsLeft: 20 },
  );
  // AAA's old softs lose 0.08×20 = 1.6 s/lap → undercut worth 2×1.6−0.6 = 2.6 s > 1.0 s gap
  assert.equal(threats[0].kind, "undercut");
  assert.equal(threats[0].attacker, "BBB");
  assert.ok(Math.abs(threats[0].gain - 2.6) < 1e-9);
  // CCC's hards barely worn → low-wear overcut chance for DDD 1 s behind
  assert.deepEqual([threats[1].kind, threats[1].attacker, threats[1].defender], ["overcut", "DDD", "CCC"]);
  assert.equal(threats.length, 2);
});

test("race laps, battle gaps and trend", () => {
  assert.equal(raceLaps(5412, 305), 57); // Bahrain-length lap
  const lap = (n: number, l: number, start: number, dur: number): Lap => ({
    driver_number: n, lap_number: l, date_start: new Date(start * 1000).toISOString(), lap_duration: dur,
    duration_sector_1: null, duration_sector_2: null, duration_sector_3: null, is_pit_out_lap: false, st_speed: null,
  });
  const laps = [lap(1, 1, 0, 90), lap(1, 2, 90, 90), lap(1, 3, 180, 90), lap(2, 1, 0, 92), lap(2, 2, 92, 89.5), lap(2, 3, 181.5, 89.5)];
  const g = battleGaps(laps, 1, 2);
  assert.deepEqual(g.map((x) => x.gap), [2, 1.5, 1]);
  assert.equal(trend(g), -0.5); // closing half a second a lap
  assert.equal(battleGaps(laps, 1, 2, 200 * 1000).length, 2); // lap 3 not finished at t=200 s
});
