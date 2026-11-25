// News aggregation from publisher RSS feeds. We only show headline + short summary + link (no full articles).
import { XMLParser } from "fast-xml-parser";

export const FEEDS = [
  { source: "Formula 1", url: "https://www.formula1.com/en/latest/all.xml" },
  { source: "Autosport", url: "https://www.autosport.com/rss/f1/news/" },
  { source: "Motorsport.com", url: "https://www.motorsport.com/rss/f1/news/" },
  { source: "RaceFans", url: "https://www.racefans.net/feed/" },
];

export type NewsItem = { title: string; link: string; source: string; date: string | null; summary: string; image: string | null };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", htmlEntities: true });

const text = (v: unknown): string =>
  v == null ? "" : typeof v === "object" ? String((v as Record<string, unknown>)["#text"] ?? "") : String(v);

const clean = (s: string) =>
  s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

function toItem(it: Record<string, any>, source: string): NewsItem | null {
  const title = clean(text(it.title));
  const link = text(it.link).trim();
  if (!title || !link.startsWith("https://")) return null;
  const d = new Date(text(it.pubDate));
  const summary = clean(text(it.description));
  return {
    title, link, source,
    date: Number.isNaN(d.getTime()) ? null : d.toISOString(),
    summary: summary.length > 240 ? summary.slice(0, 237) + "…" : summary,
    image: it.enclosure?.url ?? it["media:content"]?.url ?? it["media:thumbnail"]?.url ?? null,
  };
}

async function fetchFeed(f: (typeof FEEDS)[number]): Promise<NewsItem[]> {
  try {
    const res = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 (f1-site news reader)" }, next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = parser.parse(await res.text());
    return [xml?.rss?.channel?.item ?? []].flat().map((it) => toItem(it, f.source)).filter((x): x is NewsItem => x !== null);
  } catch (e) {
    console.error(`news feed ${f.source} failed:`, e); // one dead feed must not break the page
    return [];
  }
}

export async function getNews({ q, source }: { q?: string; source?: string } = {}): Promise<NewsItem[]> {
  const all = (await Promise.all(FEEDS.map(fetchFeed))).flat();
  const seen = new Set<string>();
  const needle = q?.toLowerCase();
  return all
    .filter((n) => {
      const key = n.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return (!source || n.source === source) && (!needle || `${n.title} ${n.summary}`.toLowerCase().includes(needle));
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
