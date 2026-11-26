// FIA document scraper: stewards' decisions, PU element usage, parc fermé changes, car upgrades.
import { extractText, getDocumentProxy } from "unpdf";
import {
  parseDecision, parseDocList, parseEventList, parseParcFerme, parsePuTable,
  type Decision, type FiaDoc, type ParcFermeChange, type PuRow,
} from "./fia-parse";
import { teamSlug } from "./media";
import { parseCarPresentation, type PdfItem, type TeamUpgrades } from "./upgrades-parse";

const BASE = "https://www.fia.com";
// shortcut: season page ids are hand-copied from fia.com; add the 2027 id when that season's page appears.
const SEASON_PAGES: Record<number, string> = {
  2026: "/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072",
};
export const FIA_SEASON = 2026;

const UA = { "User-Agent": "Mozilla/5.0 (compatible; f1-site)" };

async function get(path: string, revalidate: number) {
  const res = await fetch(BASE + path, { headers: UA, next: { revalidate } });
  if (!res.ok) throw new Error(`FIA ${res.status} for ${path}`);
  return res;
}

export async function getEvents(season = FIA_SEASON) {
  const page = SEASON_PAGES[season];
  if (!page) return [];
  return parseEventList(await (await get(page, 900)).text());
}

export async function getDocuments(eventId: string): Promise<FiaDoc[]> {
  // Drupal ajax endpoint: a list of commands, one of which inserts the event's document HTML
  const cmds: { command: string; data?: string }[] = await (await get(`/decision-document-list/ajax/${eventId}`, 120)).json();
  return parseDocList(cmds.map((c) => (c.command === "insert" ? c.data ?? "" : "")).join(""));
}

export async function pdfText(path: string): Promise<string> {
  if (!path.startsWith("/system/files/decision-document/")) throw new Error("Not an FIA decision document");
  const buf = new Uint8Array(await (await get(path, 86400)).arrayBuffer());
  const { text } = await extractText(await getDocumentProxy(buf), { mergePages: true });
  return text;
}

export type ParsedDecision = FiaDoc & Partial<Decision> & { error?: string };
export type Logbook = {
  event: { id: string; name: string } | null;
  docs: FiaDoc[]; decisions: ParsedDecision[]; summons: FiaDoc[];
  pu: { doc: FiaDoc; rows: PuRow[] } | null; parcFerme: (ParcFermeChange & { doc: FiaDoc })[]; upgrades: FiaDoc[];
};

async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

export async function getLogbook(eventId?: string): Promise<Logbook> {
  const events = await getEvents();
  const event = events.find((e) => e.id === eventId) ?? events[0] ?? null;
  if (!event) return { event: null, docs: [], decisions: [], summons: [], pu: null, parcFerme: [], upgrades: [] };
  const docs = await getDocuments(event.id);

  const decisions = await inBatches(docs.filter((d) => d.kind === "decision"), 5, async (d): Promise<ParsedDecision> => {
    try {
      return { ...d, ...parseDecision(await pdfText(d.path)) };
    } catch (e) {
      return { ...d, error: String(e) }; // keep the link even if one PDF fails
    }
  });

  const puDoc = docs.find((d) => d.kind === "pu-used");
  const pu = puDoc ? { doc: puDoc, rows: parsePuTable(await pdfText(puDoc.path)) } : null;

  const parcFerme = (
    await inBatches(docs.filter((d) => d.kind === "parc-ferme"), 5, async (doc) =>
      parseParcFerme(await pdfText(doc.path)).map((c) => ({ ...c, doc })),
    )
  ).flat();

  return {
    event, docs, decisions,
    summons: docs.filter((d) => d.kind === "summons"),
    pu, parcFerme,
    upgrades: docs.filter((d) => d.kind === "upgrades"),
  };
}

/** Stewards' decisions and summons of the most recent event (titles only, no PDF parsing), newest first. */
export async function latestStewardsDocs() {
  const [event] = await getEvents();
  if (!event) return null;
  return { event, docs: (await getDocuments(event.id)).filter((d) => d.kind === "decision" || d.kind === "summons") };
}

/** Latest PU element usage table of the season (from the most recent event that has one). */
export async function latestPuUsage(): Promise<{ event: string; rows: PuRow[]; doc: FiaDoc } | null> {
  for (const event of (await getEvents()).slice(0, 3)) {
    const doc = (await getDocuments(event.id)).find((d) => d.kind === "pu-used");
    if (doc) return { event: event.name, rows: parsePuTable(await pdfText(doc.path)), doc };
  }
  return null;
}

export const fiaUrl = (path: string) => BASE + path;

export type EventUpgrades = { eventId: string; event: string; doc: FiaDoc; teams: (TeamUpgrades & { slug: string | null })[] };

/** Positioned text of every page; these PDFs carry part photos (up to ~3.5 MB), too big for Next's 2 MB fetch cache. */
async function pdfItems(path: string): Promise<PdfItem[][]> {
  if (!path.startsWith("/system/files/decision-document/")) throw new Error("Not an FIA decision document");
  const res = await fetch(BASE + path, { headers: UA, cache: "no-store" });
  if (!res.ok) throw new Error(`FIA ${res.status} for ${path}`);
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const pages: PdfItem[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent();
    pages.push(items.flatMap((i) => ("str" in i ? [{ x: i.transform[4], y: i.transform[5], w: i.width, str: i.str }] : [])));
  }
  return pages;
}

// shortcut: in-memory per server process (a past event's document never changes; the latest is re-read hourly).
// A serverless deployment re-parses on each cold start (~20 PDFs); move to a persistent cache if that gets slow.
const upgradeMemo = new Map<string, { at: number; data: Promise<EventUpgrades | null> }>();

/** Every component each team declared as updated this season, one entry per event, newest event first. */
export async function seasonUpgrades(): Promise<EventUpgrades[]> {
  const events = await getEvents();
  const load = async (e: { id: string; name: string }): Promise<EventUpgrades | null> => {
    const doc = (await getDocuments(e.id)).find((d) => d.kind === "upgrades");
    if (!doc) return null;
    const teams = parseCarPresentation(await pdfItems(doc.path)).map((t) => ({ ...t, slug: teamSlug(t.team) }));
    return { eventId: e.id, event: e.name, doc, teams };
  };
  const res = await inBatches(events, 3, (e) => {
    const hit = upgradeMemo.get(e.id), fresh = hit && (e !== events[0] || Date.now() - hit.at < 3600_000);
    if (fresh) return hit.data;
    const data = load(e).catch((err) => { console.error("upgrades", e.name, err); upgradeMemo.delete(e.id); return null; });
    upgradeMemo.set(e.id, { at: Date.now(), data });
    return data;
  });
  return res.filter((r): r is EventUpgrades => r != null);
}
