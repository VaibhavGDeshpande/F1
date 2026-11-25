import { test } from "node:test";
import assert from "node:assert/strict";
import { GAP, overlaps, pushApart } from "./layout.ts";

test("moving a panel onto others pushes them down, cascading, and keeps the moved one in place", () => {
  const rects = [
    { id: "a", x: 0, y: 0, w: 200, h: 100 },
    { id: "b", x: 0, y: 110, w: 200, h: 100 },
    { id: "c", x: 0, y: 220, w: 200, h: 100 },
    { id: "far", x: 500, y: 0, w: 100, h: 100 },
  ];
  // drop "a" onto "b"
  const out = pushApart(rects.map((r) => (r.id === "a" ? { ...r, y: 150 } : r)), "a");
  const by = Object.fromEntries(out.map((r) => [r.id, r]));
  assert.equal(by.a.y, 150);
  assert.equal(by.b.y, 150 + 100 + GAP); // pushed below a
  assert.equal(by.c.y, by.b.y + 100 + GAP); // cascade
  assert.equal(by.far.y, 0); // untouched
  for (const p of out) for (const q of out) if (p !== q) assert.ok(!overlaps(p, q), `${p.id} overlaps ${q.id}`);
  assert.deepEqual(out.map((r) => r.id), ["a", "b", "c", "far"]); // order preserved
});
