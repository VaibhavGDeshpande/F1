import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, parseDecision, parseDocList, parseEventList, parseParcFerme, parsePuTable } from "./fia-parse.ts";

// Text shapes copied from real 2026 FIA PDFs (extracted with unpdf).
const TIME_PENALTY = `2026 LAS VEGAS GRAND PRIX
From The Stewards
Document 60
Date 21 November 2026
Time 22:08
No / Driver 16 - Charles Leclerc
Competitor Scuderia Ferrari HP
Time 21:11
Session Race
Fact Car 16 collided with Car 44 at Turn 7.
Infringement Breach of Appendix L, Chapter IV, Article 2 d) of the FIA International Sporting Code.
Decision 10 second time penalty and two (2) penalty points (total of 6 points within the 12-month period).
Reason The Stewards reviewed video and in-car video evidence.
Competitors are reminded that they have the right to appeal`;

const GRID_PENALTY = `The Stewards
From The Stewards
Time 21:22
No / Driver 87 - Oliver Bearman
Competitor TGR Haas F1 Team
Time 20:03
Session Free Practice 2
Fact The following Power Unit elements have been used:
5th Engine (ICE)
5th MGU-K
Infringement Breaches of Articles B8.2.2 a) and f) of the FIA F1 Regulations.
Decision Drop of 35 grid positions for the next Race in which the driver participates.
Reason The penalty is imposed in accordance with Article B8.2.8.`;

test("parses a time penalty with penalty points", () => {
  const d = parseDecision(TIME_PENALTY);
  assert.equal(d.car, 16);
  assert.equal(d.driver, "Charles Leclerc");
  assert.equal(d.session, "Race");
  assert.equal(d.penalty, "time");
  assert.equal(d.penaltyPoints, 2);
  assert.equal(d.totalPoints, 6);
});

test("parses a PU grid penalty with a multi-line fact", () => {
  const d = parseDecision(GRID_PENALTY);
  assert.equal(d.car, 87);
  assert.equal(d.penalty, "grid");
  assert.equal(d.gridDrop, 35);
  assert.match(d.fact!, /5th Engine \(ICE\)\n5th MGU-K/);
});

test("parses the PU usage table", () => {
  const rows = parsePuTable(`N° Car Driver ICE TC EXH MGU
-K ES PU-
81 McLaren Mercedes Oscar Piastri 4 3 3 2 3 3 5
05 Audi Gabriel Bortoleto 5 5 5 4 6 6 7`);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], { car: 5, name: "Audi Gabriel Bortoleto", used: { ICE: 5, TC: 5, EXH: 5, "MGU-K": 4, ES: 6, "PU-CE": 6, "PU-ANC": 7 } });
});

test("parses parc fermé changes with team headings", () => {
  const rows = parseParcFerme(`The following parts and parameters have been replaced / changed during the Parc Fermé yesterday
and today:
McLaren Mercedes:
Car 81: RHS gearbox differential output seal
Mercedes:
Car 63: Rear wing assembly`);
  assert.deepEqual(rows, [
    { team: "McLaren Mercedes", car: 81, change: "RHS gearbox differential output seal" },
    { team: "Mercedes", car: 63, change: "Rear wing assembly" },
  ]);
});

test("parses document rows and event list HTML", () => {
  const html = `<li class="document-row key-65"><a href="/system/files/decision-document/2026_x_-_final_race_classification.pdf" download>
  <div class="title">
    Doc 65 - Final Race Classification
  </div>
  <div class="published">Published on <span  class="date-display-single">22.11.26 09:25</span> CET</div></a></li>`;
  assert.deepEqual(parseDocList(html), [
    { no: 65, title: "Final Race Classification", path: "/system/files/decision-document/2026_x_-_final_race_classification.pdf", published: "22.11.26 09:25", kind: "classification" },
  ]);
  const events = parseEventList(`<div class="event-title active">Las Vegas Grand Prix</div>
    <ul class="document-type-wrapper open data-id-60316">
    <a href="/decision-document-list/nojs/60315" class="event-title data-id-60315  use-ajax">São Paulo Grand Prix</a>`);
  assert.deepEqual(events, [{ id: "60316", name: "Las Vegas Grand Prix" }, { id: "60315", name: "São Paulo Grand Prix" }]);
});

test("classifies document titles", () => {
  assert.equal(classify("Summons - Car 41 - Alleged unsafe release"), "summons");
  assert.equal(classify("Infringement - Car 6 - Driving unnecessarily slowly"), "decision");
  assert.equal(classify("PU Elements used per Driver up to now"), "pu-used");
  assert.equal(classify("Parts and Parameters been replaced and or changed during Parc Ferme"), "parc-ferme");
  assert.equal(classify("Car Presentation Submissions"), "upgrades");
});
