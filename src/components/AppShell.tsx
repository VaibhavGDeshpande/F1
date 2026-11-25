"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Gauge, House, Newspaper, Radio, ScrollText, Trophy, User, Users } from "lucide-react";
import { useEffect } from "react";
import { LocalTime } from "./LocalTime";
import { toast, Toaster } from "./Toaster";

const SEEN_KEY = "pitwall:seen-stewards-docs";

/** Poll the FIA document list and toast stewards' decisions / summons published since the viewer last saw them. */
function useStewardsToasts() {
  useEffect(() => {
    let seen: Set<string> | null = null;
    const check = async () => {
      try {
        const r = await fetch("/api/stewards");
        const j: { event: { id: string; name: string }; docs: { path: string; title: string; kind: string }[] } | null = r.ok ? await r.json() : null;
        if (!j) return;
        if (!seen) {
          try { const s = localStorage.getItem(SEEN_KEY); if (s) seen = new Set(JSON.parse(s)); } catch { /* storage blocked */ }
        }
        const first = !seen; // first visit ever: remember what exists, don't flood the screen
        seen ??= new Set();
        const fresh = j.docs.filter((d) => !seen!.has(d.path));
        fresh.forEach((d) => seen!.add(d.path));
        if (!first) {
          for (const d of fresh.slice(0, 3)) {
            toast({
              id: d.path, tone: d.kind === "summons" ? "amber" : "red",
              title: `${d.kind === "summons" ? "Summons" : "Stewards' decision"} · ${j.event.name}`,
              body: d.title.replace(/^(Infringement|Decision|Offence|Summons)\s*-\s*/i, ""),
              href: `https://www.fia.com${d.path}`,
            });
          }
          if (fresh.length > 3) toast({ id: `more-${fresh[3].path}`, tone: "amber", title: "Stewards", body: `${fresh.length - 3} more new documents on the Paddock page.` });
        }
        try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300))); } catch { /* storage blocked */ }
      } catch {
        // offline / FIA down: try again next tick
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);
}

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/pit-wall", label: "Pit Wall", icon: Gauge },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/standings", label: "Standings", icon: Trophy },
  { href: "/drivers", label: "Drivers", icon: User },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/paddock", label: "Paddock", icon: ScrollText },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function AppShell({ next, children }: { next: { name: string; session: string; date: string; flag: string | null } | null; children: React.ReactNode }) {
  const path = usePathname();
  useStewardsToasts();
  const title = NAV.find((n) => isActive(path, n.href))?.label ?? (path.startsWith("/session") || path.startsWith("/weekend") ? "Race analysis" : "");

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 p-3 lg:p-4">
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-56 shrink-0 flex-col rounded-2xl border border-neutral-800 bg-[#111113] p-3 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2 pt-1">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-red-600 text-xs font-black">PW</span>
          <span className="font-display text-xl font-bold tracking-wide">PIT WALL</span>
        </Link>
        <nav className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive(path, href) ? "bg-red-600 text-white" : "text-neutral-300 hover:bg-neutral-800/70"}`}>
              <Icon size={17} />{label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-snug text-neutral-500">Unofficial fan site. Not associated with Formula 1 companies or the FIA.</p>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <header className="sticky top-3 z-20 flex items-center gap-3 rounded-2xl border border-neutral-800 bg-[#111113]/95 px-4 py-3 backdrop-blur lg:top-4">
          <span className="font-display text-xl font-bold uppercase tracking-wide">{title}</span>
          {next && (
            <span className="hidden items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs sm:flex">
              {next.flag && <img src={next.flag} alt="" className="h-3 w-4 rounded-sm object-cover" />}
              <b>{next.name}</b>
              <span className="text-neutral-400">{next.session}, <LocalTime iso={next.date} /></span>
            </span>
          )}
        </header>
        {/* phone / tablet nav */}
        <nav className="flex gap-1 overflow-x-auto lg:hidden">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${isActive(path, href) ? "bg-red-600" : "bg-neutral-900 text-neutral-300"}`}>{label}</Link>
          ))}
        </nav>
        <main className="px-1">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
