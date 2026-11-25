import { test } from "node:test";
import assert from "node:assert/strict";
import { isRadioUrl, to16k } from "./radio.ts";

test("to16k averages 48 kHz down to 16 kHz", () => {
  const out = to16k(new Float32Array([0, 0.3, 0.6, 1, 1, 1]), 48000);
  assert.equal(out.length, 2);
  assert.ok(Math.abs(out[0] - 0.3) < 1e-6);
  assert.equal(out[1], 1);
});

test("only F1 team radio MP3 URLs are accepted", () => {
  assert.ok(isRadioUrl("https://livetiming.formula1.com/static/2026/2026-11-21_Las_Vegas_Grand_Prix/2026-11-21_Race/TeamRadio/NOR_1_20261121_213312.mp3"));
  assert.ok(!isRadioUrl("https://evil.example/static/x/TeamRadio/a.mp3"));
  assert.ok(!isRadioUrl("https://livetiming.formula1.com/static/../TeamRadio/a.mp3"));
  assert.ok(!isRadioUrl("http://livetiming.formula1.com/static/2026/TeamRadio/a.mp3"));
});
