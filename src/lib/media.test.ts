import { test } from "node:test";
import assert from "node:assert/strict";
import { driverPortrait, driverRef, refFromHeadshot, teamSlug } from "./media.ts";

test("team names from OpenF1 and Jolpica map to formula1.com slugs", () => {
  assert.equal(teamSlug("Red Bull Racing"), "redbullracing");
  assert.equal(teamSlug("red_bull"), "redbullracing");
  assert.equal(teamSlug("Racing Bulls"), "racingbulls");
  assert.equal(teamSlug("RB F1 Team"), "racingbulls");
  assert.equal(teamSlug("rb"), "racingbulls");
  assert.equal(teamSlug("Haas F1 Team"), "haasf1team");
  assert.equal(teamSlug("aston_martin"), "astonmartin");
  assert.equal(teamSlug("Cadillac F1 Team"), "cadillac");
  assert.equal(teamSlug("Unknown Racing"), null);
});

test("driver references follow formula1.com's scheme", () => {
  assert.equal(driverRef("Andrea Kimi", "Antonelli"), "andant01");
  assert.equal(driverRef("Nico", "Hülkenberg"), "nichul01");
  assert.equal(driverRef("Rafael", "Câmara"), "rafcam01");
  assert.equal(refFromHeadshot("https://media.formula1.com/x/drivers/L/LANNOR01_Lando_Norris/lannor01.png"), "lannor01");
  assert.match(driverPortrait("McLaren", "lannor01")!, /\/mclaren\/lannor01\/\d{4}mclarenlannor01right\.webp$/);
});
