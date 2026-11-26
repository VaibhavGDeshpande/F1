import { test } from "node:test";
import assert from "node:assert/strict";
import { beforeAfter, lapSeconds, qualiGaps, raceKey } from "./upgrade-pace.ts";

test("lap times parse; no time is null", () => {
  assert.equal(lapSeconds("1:18.518"), 78.518);
  assert.equal(lapSeconds("59.9"), 59.9);
  assert.equal(lapSeconds(""), null);
  assert.equal(lapSeconds(undefined), null);
});

test("each team's best lap of the session vs the fastest, in %", () => {
  const slug = (t: string) => ({ Mercedes: "mercedes", McLaren: "mclaren" } as Record<string, string>)[t] ?? null;
  const [r] = qualiGaps([{
    round: 1, race: "Australian Grand Prix", rows: [
      { team: "Mercedes", times: ["1:20.000", "1:19.500", "1:19.000"] },
      { team: "Mercedes", times: ["1:20.200", "1:19.800", undefined] },
      { team: "McLaren", times: ["1:19.790", "", undefined] }, // best lap set in Q1 still counts
      { team: "Unknown", times: ["1:10.000"] }, // teams we can't name are left out
    ],
  }], slug);
  assert.deepEqual(r.gap, { mercedes: 0, mclaren: 1 });
});

test("FIA event names meet Jolpica race names", () => {
  assert.equal(raceKey("Barcelona-Catalunya Grand Prix"), raceKey("Barcelona Grand Prix"));
  assert.equal(raceKey("São Paulo Grand Prix"), raceKey("Brazilian Grand Prix"));
  assert.equal(raceKey("Bahrain Grand Prix"), raceKey("Bahrain Grand Prix in Malaysia"));
  assert.notEqual(raceKey("Austrian Grand Prix"), raceKey("Australian Grand Prix"));
});

test("before/after averages; the upgrade weekend counts as after", () => {
  assert.deepEqual(beforeAfter([2, 2, 2, 1, 1, 1], 3), { before: 2, after: 1 });
  assert.deepEqual(beforeAfter([3, undefined, 1, 1], 2, 2), { before: 3, after: 1 });
  assert.equal(beforeAfter([1, 1], 0), null, "nothing before the first round");
});
