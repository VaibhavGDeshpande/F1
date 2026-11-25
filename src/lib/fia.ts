// FIA document scraper: stewards' decisions, PU element usage, parc fermé changes, car upgrades.
import { extractText, getDocumentProxy } from "unpdf";
import {
  parseDecision, parseDocList, parseEventList, parseParcFerme, parsePuTable,
  type Decision, type FiaDoc, type ParcFermeChange, type PuRow,
} from "./fia-parse";

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
