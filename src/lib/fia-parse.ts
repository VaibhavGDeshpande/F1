// Pure parsers for FIA document pages and PDF text (no I/O, unit-tested in fia-parse.test.ts).

export type DocKind = "decision" | "summons" | "pu-used" | "pu-new" | "parc-ferme" | "upgrades" | "classification" | "other";
export type FiaDoc = { no: number | null; title: string; path: string; published: string | null; kind: DocKind };
export type FiaEvent = { id: string; name: string };

const decode = (s: string) =>
  s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

export function classify(title: string): DocKind {
  const t = title.toLowerCase();
  if (t.startsWith("summons")) return "summons";
  if (/^(infringement|decision|offence)/.test(t)) return "decision";
  if (t.includes("pu elements used")) return "pu-used";
  if (t.includes("new pu elements")) return "pu-new";
  if (/parc ferm|parts and parameters/.test(t)) return "parc-ferme";
  if (t.includes("car presentation")) return "upgrades";
  if (/classification|starting grid|championship points/.test(t)) return "classification";
  return "other";
}

/** Document rows of one event (FIA season page or its ajax event fragment). */
export function parseDocList(html: string): FiaDoc[] {
  const out: FiaDoc[] = [];
  const re = /<a href="(\/system\/files\/decision-document\/[^"]+\.pdf)"[\s\S]*?<div class="title">([\s\S]*?)<\/div>[\s\S]*?date-display-single">([^<]*)</g;
  for (const m of html.matchAll(re)) {
    const raw = decode(m[2]);
    const no = raw.match(/^Doc (\d+)\s*-\s*/);
    const title = no ? raw.slice(no[0].length) : raw;
    out.push({ no: no ? Number(no[1]) : null, title, path: m[1], published: m[3].trim() || null, kind: classify(title) });
  }
  return out;
}

/** Events of a season page: the open one first, then the rest (newest first). */
export function parseEventList(html: string): FiaEvent[] {
  const out: FiaEvent[] = [];
  const active = html.match(/<div class="event-title active">([^<]*)<\/div>\s*<ul class="document-type-wrapper[^"]*data-id-(\d+)/);
  if (active) out.push({ id: active[2], name: decode(active[1]) });
  for (const m of html.matchAll(/<a href="\/decision-document-list\/nojs\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (!out.some((e) => e.id === m[1])) out.push({ id: m[1], name: decode(m[2]) });
  }
  return out;
}

export type PenaltyKind = "grid" | "dsq" | "drive-through" | "stop-go" | "time" | "reprimand" | "fine" | "warning" | "no-action" | "other";
export type Decision = {
  car: number | null; driver: string | null; competitor: string | null; session: string | null;
  fact: string | null; infringement: string | null; decision: string | null;
  penalty: PenaltyKind; gridDrop: number | null; penaltyPoints: number | null; totalPoints: number | null;
};

const LABELS = ["No / Driver", "Competitor", "Time", "Session", "Fact", "Infringement", "Decision", "Reason"] as const;

export function penaltyKind(decision: string): PenaltyKind {
  const d = decision.toLowerCase();
  if (/grid (position|place)|back of the grid|pit ?lane/.test(d)) return "grid";
  if (/disqualif/.test(d)) return "dsq";
  if (/drive[- ]through/.test(d)) return "drive-through";
  if (/stop[- ](and[- ])?go/.test(d)) return "stop-go";
  if (/time penalty|second penalty/.test(d)) return "time";
  if (/reprimand/.test(d)) return "reprimand";
  if (/\bfine\b|€|\beur\b/.test(d)) return "fine";
  if (/warning/.test(d)) return "warning";
  if (/no further action|no action/.test(d)) return "no-action";
  return "other";
}

/** Stewards' decision PDF text → structured fields. Docs without a car (e.g. deleted lap lists) give car = null. */
export function parseDecision(text: string): Decision {
  const fields: Record<string, string> = {};
  let current: string | null = null;
  for (const line of text.split("\n").map((l) => l.trim())) {
    if (current && /^(Competitors are reminded|Decisions of the Stewards|The Stewards$)/.test(line)) break;
    // "Time" also appears in the document header, so only start collecting at a real decision label
    const label = LABELS.find((l) => line === l || line.startsWith(l + " "));
    if (label && (current || label !== "Time")) {
      current = label;
      fields[label] = line.slice(label.length).trim();
    } else if (current && line) {
      fields[current] += (fields[current] ? "\n" : "") + line;
    }
  }
  const nd = fields["No / Driver"]?.match(/^(\d+)\s*-\s*(.+)$/);
  const decision = fields["Decision"] ?? null;
  const points = decision?.match(/\((\d+)\)\s*penalty points?|(\d+)\s*penalty points?/i);
  return {
    car: nd ? Number(nd[1]) : null,
    driver: nd ? nd[2].trim() : null,
    competitor: fields["Competitor"] ?? null,
    session: fields["Session"] ?? null,
    fact: fields["Fact"] ?? null,
    infringement: fields["Infringement"] ?? null,
    decision,
    penalty: decision ? penaltyKind(decision) : "other",
    gridDrop: Number(decision?.match(/(\d+) grid (?:positions?|places?)/i)?.[1]) || null,
    penaltyPoints: points ? Number(points[1] ?? points[2]) : null,
    totalPoints: Number(decision?.match(/total of (\d+)/i)?.[1]) || null,
  };
}

export const PU_ELEMENTS = ["ICE", "TC", "EXH", "MGU-K", "ES", "PU-CE", "PU-ANC"] as const;
export type PuElement = (typeof PU_ELEMENTS)[number];
// Limits stated in 2026 Technical Delegate reports ("the fifth (5th) of the four (4) ... allowed").
// ES / PU-CE / PU-ANC limits are not stated in those reports, so we don't guess them.
export const PU_LIMITS: Record<PuElement, number | null> = { ICE: 4, TC: 4, EXH: 4, "MGU-K": 4, ES: null, "PU-CE": null, "PU-ANC": null };

export type PuRow = { car: number; name: string; used: Record<PuElement, number> };

/** "PU Elements used per Driver up to now" PDF text → one row per car. */
export function parsePuTable(text: string): PuRow[] {
  const rows: PuRow[] = [];
  for (const line of text.split("\n")) {
    const m = line.trim().match(/^(\d{1,2})\s+(.+?)((?:\s+\d+){7})$/);
    if (!m) continue;
    const nums = m[3].trim().split(/\s+/).map(Number);
    rows.push({ car: Number(m[1]), name: m[2], used: Object.fromEntries(PU_ELEMENTS.map((e, i) => [e, nums[i]])) as PuRow["used"] });
  }
  return rows;
}

export type ParcFermeChange = { team: string | null; car: number; change: string };

/** "Parts and parameters replaced during Parc Fermé" PDF text → list of changes. */
export function parseParcFerme(text: string): ParcFermeChange[] {
  const out: ParcFermeChange[] = [];
  let team: string | null = null;
  for (const line of text.split("\n").map((l) => l.trim())) {
    const car = line.match(/^Car (\d+):\s*(.+)$/);
    if (car) out.push({ team, car: Number(car[1]), change: car[2] });
    else if (/^[^:]+:$/.test(line)) team = line.slice(0, -1);
  }
  return out;
}
