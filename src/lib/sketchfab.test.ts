import { test } from "node:test";
import assert from "node:assert/strict";
import { isTeamCar, realThumb, yearOf } from "./sketchfab.ts";

test("Sketchfab's shared placeholder is not a real thumbnail", () => {
  const h = (url: string) => ({ uid: "abc", thumbnails: { images: [{ url, width: 640 }] } });
  assert.equal(realThumb(h("https://media.sketchfab.com/thumbnails/4c57687b657445e1b46c83b35e494ad4/640.jpg")), null);
  assert.equal(realThumb(h("https://media.sketchfab.com/models/abc/thumbnails/x/640.jpeg")), "https://media.sketchfab.com/models/abc/thumbnails/x/640.jpeg");
});

const hit = (name: string, tags: string[] = []) => ({ name, tags: tags.map((t) => ({ name: t })) });

test("year from name or tags", () => {
  assert.equal(yearOf(hit("2026 McLaren MCL40")), 2026);
  assert.equal(yearOf(hit("Ferrari SF-26", ["f1", "2026"])), 2026);
  assert.equal(yearOf(hit("Ferrari SF-26")), null);
});

test("only the right team's car from the right year", () => {
  assert.ok(isTeamCar(hit("2026 Redbull RB22"), "redbullracing", 2026));
  assert.ok(!isTeamCar(hit("2026 Redbull RB22"), "racingbulls", 2026)); // Racing Bulls search returns Red Bull cars
  assert.ok(!isTeamCar(hit("2026 Audi R26"), "alpine", 2026)); // Alpine search returns Audi cars
  assert.ok(!isTeamCar(hit("F1 2021 McLaren MCL35M"), "mclaren", 2026)); // wrong year
  assert.ok(!isTeamCar(hit("ISACK HADJAR 2026 Red Bull helmet"), "redbullracing", 2026)); // not a car
  assert.ok(!isTeamCar(hit("Scuderia Ferrari HP 2026 Concept"), "ferrari", 2026));
  // road cars of the same brand and year
  assert.ok(!isTeamCar(hit("2026 Mercedes-Benz CLA Sedan EV"), "mercedes", 2026));
  assert.ok(!isTeamCar(hit("2026 Mercedes-AMG GT63 Pro"), "mercedes", 2026));
  assert.ok(isTeamCar(hit("2026 Mercedes W17"), "mercedes", 2026)); // chassis code is enough
  assert.ok(isTeamCar(hit("2026 Cadillac race car", ["formula1"]), "cadillac", 2026)); // an F1 tag counts too
  assert.ok(!isTeamCar(hit("2026 Cadillac Escalade"), "cadillac", 2026)); // no F1 signal at all
  assert.ok(isTeamCar(hit("2026 Cadillac MAC-26"), "cadillac", 2026));
});
