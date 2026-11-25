import { test } from "node:test";
import assert from "node:assert/strict";
import { CORNER_NAMES, cornerName } from "./corner-names.ts";

// FIA corner counts per circuit_key (from MultiViewer); a name on a corner number that doesn't exist means a typo
const CORNERS: Record<number, number> = { 2: 18, 39: 11, 7: 19, 22: 19, 46: 18, 14: 15, 55: 14, 23: 14, 6: 19, 19: 10 };

test("every named corner exists on its circuit", () => {
  for (const [key, names] of Object.entries(CORNER_NAMES)) {
    assert.ok(CORNERS[Number(key)], `no corner count for circuit ${key}`);
    for (const n of Object.keys(names)) assert.ok(Number(n) >= 1 && Number(n) <= CORNERS[Number(key)], `circuit ${key} turn ${n}`);
  }
});

test("lookup by circuit_key and corner number", () => {
  assert.equal(cornerName(39, 11), "Parabolica");
  assert.equal(cornerName(7, 2), "Eau Rouge");
  assert.equal(cornerName(152, 1), undefined); // Las Vegas: no traditional names
});
