import { test } from "node:test";
import assert from "node:assert/strict";
import { compass, summarise } from "./weather.ts";

test("session forecast summary over the session's hours", () => {
  const h = {
    time: ["2026-11-27T13:00", "2026-11-27T14:00", "2026-11-27T15:00", "2026-11-27T16:00"],
    temperature_2m: [30, 28, 26, 20], precipitation_probability: [0, 10, 40, 90], precipitation: [0, 0, 0.5, 3],
    wind_speed_10m: [10, 20, 30, 40], wind_direction_10m: [90, 90, 90, 90], cloud_cover: [0, 50, 100, 100],
  };
  // 14:30–15:30 covers the 14:00 and 15:00 hours
  const f = summarise(h, "2026-11-27T14:30:00+00:00", "2026-11-27T15:30:00+00:00")!;
  assert.deepEqual(f, { temp: 27, rainChance: 40, rainMm: 0.5, wind: 25, windFrom: "E", cloud: 75 });
  assert.equal(summarise(h, "2026-12-01T10:00:00Z", "2026-12-01T11:00:00Z"), null);
  assert.equal(compass(350), "N");
  assert.equal(compass(225), "SW");
});
