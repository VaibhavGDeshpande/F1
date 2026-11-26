import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCarPresentation, splitReason, type PdfItem } from "./upgrades-parse.ts";

const it = (x: number, y: number, str: string, w = str.length * 5): PdfItem => ({ x, y, w, str });
// header block as laid out in the 2026 documents
const header = (team: string) => [
  it(289, 490, "Car Presentation"), it(404, 490, "–"), it(415, 490, "Las V", 34), it(449, 490, "egas"), it(322, 468, team),
  it(117, 437, "Updated"), it(109, 423, "component"), it(188, 437, "Primary reason"), it(200, 423, "for update"),
  it(305, 437, "Geometric differences compared to"), it(358, 423, "previous version"),
  it(536, 437, "Brief description on how the update works"), it(583, 423, "(min 20, max 100 words)"),
];

test("rows rebuilt from positions; body text starting with 'Updated' is not mistaken for the header", () => {
  const page = [
    ...header("Audi Revolut F1 Team"),
    it(84, 394, "1"), it(113, 394, "Rear Corner"), it(191, 401, "Circuit Specific"), it(259, 401, "–"), it(202, 387, "Drag Range"),
    it(325, 394, "Updated rear brake duct deflector"), it(531, 408, "The revised deflector geometry was"), it(531, 394, "modified for Vegas."),
    it(75, 28, "Audi Revolut F1 Team"), it(33, 28, "2"), // footer
  ];
  const cover = [it(72, 300, "Title Car Presentation Submissions"), it(80, 280, "Car Presentation Submissions")];
  const [audi, ...rest] = parseCarPresentation([cover, page]);
  assert.equal(rest.length, 0, "cover page is not a team");
  assert.equal(audi.team, "Audi Revolut F1 Team");
  assert.deepEqual(audi.updates, [{
    component: "Rear Corner", reason: "Circuit Specific Drag Range", change: "Updated rear brake duct deflector",
    description: "The revised deflector geometry was modified for Vegas.",
  }]);
});

test("a reason cell merged across rows is shared with the rows it spans; 'no updates' pages", () => {
  const page = [
    ...header("SCUDERIA FERRARI HP"),
    it(84, 395, "1"), it(116, 395, "Floor Body"), it(282, 389, "Front floor leading edge"),
    it(84, 355, "2"), it(114, 355, "Floor Board"), it(282, 355, "Board brace layout"),
    it(195, 340, "Performance"), it(195, 326, "Local Load"), it(531, 377, "More floor downforce."),
  ];
  const none = [it(289, 490, "Car Presentation – Las Vegas Grand Prix"), it(320, 468, "Williams"), it(72, 430, "No updates submitted for this event.")];
  const drawing: PdfItem[] = []; // image-only page after Ferrari's table
  const [ferrari, williams] = parseCarPresentation([page, drawing, none]);
  assert.deepEqual(ferrari.updates.map((u) => [u.component, u.reason, u.description]), [
    ["Floor Body", "Performance Local Load", "More floor downforce."],
    ["Floor Board", "Performance Local Load", "More floor downforce."],
  ]);
  assert.deepEqual(ferrari.pages, [1, 2], "table page plus its drawing page");
  assert.deepEqual(williams, { team: "Williams", noUpdates: true, updates: [], pages: [3] });
});

test("header phrases placed lower than usual are not read as cell text", () => {
  const page = [
    it(289, 490, "Car Presentation – Monaco Grand Prix"), it(322, 468, "Mercedes-AMG PETRONAS F1 Team"),
    it(117, 400, "Updated component"), it(188, 400, "Primary reason for update"), it(305, 400, "Geometric differences compared to previous version"),
    it(536, 400, "Brief description on how the update works (min 20, max 100 words)"),
    it(84, 360, "1"), it(119, 360, "Rear Wing"), it(185, 360, "Circuit specific - Downforce Range"), it(302, 360, "Higher camber flap"), it(540, 360, "More load for Monaco."),
  ];
  const [merc] = parseCarPresentation([page]);
  assert.deepEqual(merc.updates, [{ component: "Rear Wing", reason: "Circuit specific - Downforce Range", change: "Higher camber flap", description: "More load for Monaco." }]);
});

test("reason split into kind and detail", () => {
  assert.deepEqual(splitReason("Performance - Flow Conditioning"), { kind: "Performance", detail: "Flow Conditioning" });
  assert.deepEqual(splitReason("Circuit Specific Drag Range"), { kind: "Circuit specific", detail: "Drag Range" });
  assert.deepEqual(splitReason("Cooling Range"), { kind: "Cooling range", detail: "" });
});
