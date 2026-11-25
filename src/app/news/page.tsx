import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { FEEDS, getNews } from "@/lib/news";

export const metadata = { title: "News" };

export default async function News({ searchParams }: { searchParams: Promise<{ q?: string; source?: string }> }) {
  const { q, source } = await searchParams;
  const query = q?.slice(0, 100);
  const news = await getNews({ q: query, source });
  const href = (s?: string) => `/news?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(s ? { source: s } : {}) })}`;

  return (
    <div className="space-y-4">
      <h1 className="h1">F1 news</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={query} placeholder="Search: driver, team, penalty, upgrade…" className="w-full max-w-md rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm" />
        {source && <input type="hidden" name="source" value={source} />}
        <button className="chip">Search</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Link href={href()} className={`chip ${!source ? "chip-on" : ""}`}>All sources</Link>
        {FEEDS.map((f) => <Link key={f.source} href={href(f.source)} className={`chip ${source === f.source ? "chip-on" : ""}`}>{f.source}</Link>)}
      </div>
      {news.length === 0 && <p className="muted">No articles found.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {news.map((n) => (
          <li key={n.link} className="card flex gap-3">
            {n.image && <img src={n.image} alt="" className="h-20 w-32 shrink-0 rounded object-cover" loading="lazy" />}
            <div>
              <a href={n.link} target="_blank" rel="noreferrer" className="font-medium hover:underline">{n.title}</a>
              <p className="muted mt-1 line-clamp-2 text-sm">{n.summary}</p>
              <div className="mt-1 text-xs text-neutral-500">{n.source}{n.date && <> · <LocalTime iso={n.date} /></>}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
