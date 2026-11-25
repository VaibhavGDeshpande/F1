import Link from "next/link";
import {
  BookOpen, Box, CalendarDays, Database, FlaskConical, Gauge, House, Keyboard, LayoutDashboard, Lightbulb, Newspaper, Radio, ScrollText, Trophy, User,
} from "lucide-react";

export const metadata = { title: "Guide" };

type Section = {
  id: string; icon: React.ComponentType<{ size?: number; className?: string }>; title: string; href?: string;
  what: string; how: string[]; tips?: string[];
};

const SECTIONS: Section[] = [
  {
    id: "home", icon: House, title: "Home", href: "/",
    what: "Everything at a glance: the next session with a countdown and weather, the last race result, both championships, the latest news and stewards' decisions.",
    how: [
      "The top-left panel switches to ● LIVE NOW while a session is running. Click Live timing to follow it.",
      "Weekend preview opens the track profile, favourites and the 3D track for the coming race.",
      "Ticked sessions in the weekend list open their full analysis.",
    ],
  },
  {
    id: "live", icon: Radio, title: "Live timing & replay", href: "/live",
    what: "The timing tower, a smooth moving track map, race control, team radio with transcripts, and during races a strategy panel and a battle tracker.",
    how: [
      "During a session it updates on its own every few seconds. Otherwise pick any finished session in the dropdown to replay it.",
      "Replay: ▶ / ❚❚ to play and pause, 1× / 4× / 16× for speed, and drag the slider to jump anywhere in the session.",
      "Click a driver in the tower to highlight them on the map and see their speed, throttle and brake for the last 40 seconds.",
      "The ⤢ button in the map's corner opens the circuit full size with corner names and the running order. Press Esc to close it.",
      "Strategy (races only): where each driver would rejoin if they pitted now, whether their pit window is open, and undercut / overcut threats.",
      "Battle: choose any two drivers to see the gap after every lap. A toast fires when the chaser gets within a second.",
    ],
    tips: [
      "Toasts pop up bottom-right for penalties, flags, fastest laps, pit stops and retirements.",
      "Radio transcripts are made by a speech model on the server. The first one after a restart takes ~30 s, then ~10 s each.",
      "The live map runs ~7 s behind real time on purpose, so cars glide instead of jumping.",
    ],
  },
  {
    id: "dashboard", icon: LayoutDashboard, title: "Telemetry dashboard (build your own)", href: "/dashboard",
    what: "The same live and replay data as the Live page, laid out on a canvas you arrange yourself, like a real pit wall screen.",
    how: [
      "Drag a panel by its title bar to move it anywhere; drag the bottom-right corner to resize it. Panels snap to a 10 px grid and can overlap.",
      "Click a panel to bring it to the front. ✕ removes it, and + Add widget puts it back.",
      "Lock layout stops accidental moves while you watch; Reset layout restores the default arrangement.",
      "Keyboard: Tab to a title bar, then arrow keys move it and Shift+arrows resize it.",
    ],
    tips: ["Your layout is saved in this browser, so it's there next time (each browser keeps its own)."],
  },
  {
    id: "pitwall", icon: Gauge, title: "Pit Wall (lap comparison)", href: "/pit-wall",
    what: "Up to four drivers' laps replayed together: telemetry traces, a track map, live inputs, a corner-by-corner table and energy-clipping detection.",
    how: [
      "Pick the season, Grand Prix and session at the top, then tick drivers in the list on the left (up to 4). The first one is the reference (REF).",
      "Press ▶ to replay the laps together: the cursor moves along the speed, throttle, brake, gear and RPM traces.",
      "Click any point on the lap-times chart to load that lap instead of the fastest one.",
      "Focus shows only the reference driver's traces; Overlay shows everyone.",
      "Track position: switch 2D / 3D, or ⤢ for full size. In 2D the track is coloured by who is faster in each mini-sector.",
      "Corner by corner: braking point, minimum speed, power-on point and time gained or lost in every corner. Bold marks the best.",
      "Energy clipping: where a car was flat out yet slowing (the battery ran out). These zones are also shaded on the speed trace.",
    ],
    tips: ["The 🔗 button copies a link to exactly what you're looking at: drivers, laps and session."],
  },
  {
    id: "racesim", icon: FlaskConical, title: "Race simulator", href: "/race-sim",
    what: "Finds the fastest tyre strategy for a race, then runs it 3,000 times with random safety cars to see how often it really wins.",
    how: [
      "Choose a Grand Prix. Every input starts from real data: race laps, pit-stop time loss, safety-car history, tyre wear and life.",
      "Change any input and the results update straight away. Reset to data brings the real values back.",
      "Max laps per tyre set: some races have a Pirelli limit (27 at Qatar 2026), which can force an extra stop.",
      "Read the table: Avg vs best (average time lost), Likely range (best and worst 10% of races), Fastest in (share of races it wins) and the pit window (white on the stint bar).",
    ],
    tips: ["The best average plan isn't always the one that wins most often. The page warns you when they differ."],
  },
  {
    id: "calendar", icon: CalendarDays, title: "Calendar & weekend pages", href: "/calendar",
    what: "Every round with session times in your timezone. Each weekend page has the preview, a session list with weather forecasts, and tyre wear across the weekend.",
    how: [
      "Click a Grand Prix name to open its weekend page.",
      "Weekend preview: track type (high-speed, power-sensitive…), corner speeds, a rotating 3D track, and the favourites from pace, form and track history.",
      "The forecast next to each upcoming session shows air temperature, rain chance and wind (up to 16 days ahead).",
    ],
  },
  {
    id: "session", icon: Trophy, title: "Session analysis",
    what: "Open any finished session from the calendar, a weekend page or the home page.",
    how: [
      "Classification, tyre strategy bars, positions lap by lap (races), lap times of the top six and pit-stop times.",
      "Tyre degradation: seconds lost per lap of tyre age for each compound, from clean laps only.",
      "Compare laps on the Pit Wall jumps to a telemetry comparison of that session.",
    ],
  },
  {
    id: "standings", icon: Trophy, title: "Standings", href: "/standings",
    what: "Drivers' and constructors' championships with points bars and the gap to the leader. Type a year to see any season back to 1950.",
    how: [],
  },
  {
    id: "drivers", icon: User, title: "Drivers & teams", href: "/drivers",
    what: "Cards for every driver and team. Open one for season stats, a race-by-race chart, results, engine parts used and related news.",
    how: [
      "Season at a glance: one chip per round (gold / silver / bronze for podiums, green for points, red for a DNF), with a bar for points scored.",
      "+/− shows places gained or lost from the start.",
      "Engine parts used: amber means at the season limit (one more = grid penalty), red means over it.",
    ],
  },
  {
    id: "cars", icon: Box, title: "3D cars", href: "/cars",
    what: "Community-made 3D models of this year's cars from Sketchfab, in Sketchfab's own viewer.",
    how: [
      "Pick a team below the viewer, then press View in 3D. Models are big, so only one loads at a time.",
      "Drag to spin, scroll to zoom, and switch between alternative models under the viewer.",
    ],
    tips: ["These are fan models, not official CAD. Each one credits its author with a link to Sketchfab."],
  },
  {
    id: "news", icon: Newspaper, title: "News", href: "/news",
    what: "Headlines from Formula 1, Autosport, Motorsport.com and RaceFans in one feed. Search by driver, team or topic, or filter by source.",
    how: ["Click a headline to read the full article on the publisher's site."],
  },
  {
    id: "paddock", icon: ScrollText, title: "Paddock (FIA documents)", href: "/paddock",
    what: "Stewards' decisions, summons, engine parts used and parc fermé changes, read automatically from the official FIA documents.",
    how: [
      "Pick an event in the chips at the top.",
      "Each decision shows the driver, session, what happened and the penalty (time, grid drop, reprimand…) with penalty points.",
      "New decisions also appear as toasts on every page while you browse.",
    ],
    tips: ["Always check the linked PDF for the exact wording. The parsing is automatic."],
  },
];

const GLOSSARY: [string, string][] = [
  ["Gap / Int", "Gap = seconds behind the leader. Int (interval) = seconds behind the car directly ahead."],
  ["Purple / green / yellow sector", "Fastest of anyone / the driver's own best / slower than their best."],
  ["Tyre age", "Laps a set of tyres has done, including earlier sessions."],
  ["Degradation (deg)", "How much slower a tyre gets each lap as it wears, in seconds per lap."],
  ["Pit loss", "Time lost driving through the pit lane compared with staying out. Cheaper under a safety car because everyone is slow."],
  ["Undercut", "Pitting before the car ahead to gain time on fresh tyres while they're on old ones."],
  ["Overcut", "Staying out longer than the car ahead when your tyres are still good, and gaining while they warm up new ones."],
  ["Pit window", "The laps on which a stop costs least overall. 'Open' means a stop now would win its time back before the flag."],
  ["SC / VSC", "Safety car / virtual safety car. The field slows down and gaps close up."],
  ["Clipping", "The car is flat out, but speed stops rising because the battery has run out of electrical power for that lap."],
  ["Mini-sector", "A small slice of the lap (we use 25) used to see who is faster where."],
  ["Parc fermé", "After qualifying the cars are locked: changing parts needs permission and is listed in the FIA documents."],
  ["Penalty points", "Added to a driver's licence for incidents. 12 within 12 months means a one-race ban."],
];

export default function Guide() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1 flex items-center gap-3"><BookOpen size={30} />How to use Pit Wall</h1>
        <p className="muted max-w-3xl text-sm">
          A quick tour of every page: what it shows, how to use it and what the numbers mean. Use the sidebar on the left (or the row of
          buttons at the top on a phone) to move between pages.
        </p>
      </header>

      <section className="card" style={{ background: "linear-gradient(120deg,#7f1d1d55,#111113 60%)" }}>
        <h2 className="h2 text-base"><Lightbulb size={16} className="text-amber-300" />Quick start: a race weekend in 5 steps</h2>
        <ol className="grid gap-3 text-sm md:grid-cols-5">
          {[
            ["Preview", "Open Home → Weekend preview: track type, favourites, weather.", "/"],
            ["Plan", "Race Sim: what's the best strategy, and how risky is it?", "/race-sim"],
            ["Watch", "Live: timing, map, radio, strategy and toasts while it happens.", "/live"],
            ["Analyse", "Pit Wall: compare laps corner by corner after the session.", "/pit-wall"],
            ["Check", "Paddock: penalties and parts changes from the FIA.", "/paddock"],
          ].map(([t, d, href], i) => (
            <li key={t} className="rounded-xl border border-neutral-800 bg-black/30 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-red-600 text-xs font-bold">{i + 1}</span>
                <Link href={href} className="font-semibold hover:underline">{t}</Link>
              </div>
              <p className="text-xs text-neutral-300">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Guide contents" className="h-fit space-y-1 text-sm lg:sticky lg:top-24">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Contents</div>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-neutral-300 hover:bg-neutral-800/70">
              <s.icon size={14} />{s.title}
            </a>
          ))}
          <a href="#glossary" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-neutral-300 hover:bg-neutral-800/70"><BookOpen size={14} />Glossary</a>
          <a href="#data" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-neutral-300 hover:bg-neutral-800/70"><Database size={14} />Data & limits</a>
          <a href="#keys" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-neutral-300 hover:bg-neutral-800/70"><Keyboard size={14} />Shortcuts</a>
        </nav>

        <div className="min-w-0 space-y-4">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="card scroll-mt-24">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <s.icon size={18} className="text-red-500" />
                <h2 className="font-display text-2xl font-bold uppercase">{s.title}</h2>
                {s.href && <Link href={s.href} className="pill pill-on ml-auto">Open →</Link>}
              </div>
              <p className="text-sm text-neutral-200">{s.what}</p>
              {s.how.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-300 marker:text-red-500">
                  {s.how.map((h) => <li key={h}>{h}</li>)}
                </ul>
              )}
              {s.tips && (
                <div className="mt-3 space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/90">
                  {s.tips.map((t) => <p key={t}>💡 {t}</p>)}
                </div>
              )}
            </section>
          ))}

          <section id="glossary" className="card scroll-mt-24">
            <h2 className="mb-3 font-display text-2xl font-bold uppercase">Glossary</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
              {GLOSSARY.map(([term, def]) => (
                <div key={term}>
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-neutral-400">{def}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              {[["Soft", "#e8002d"], ["Medium", "#ffd12e"], ["Hard", "#f0f0ec"], ["Intermediate", "#43b02a"], ["Wet", "#0067ad"]].map(([n, c]) => (
                <span key={n} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: c }} />{n}</span>
              ))}
              <span className="text-neutral-500">: tyre compound colours used everywhere</span>
            </div>
          </section>

          <section id="data" className="card scroll-mt-24">
            <h2 className="mb-3 font-display text-2xl font-bold uppercase">Where the data comes from</h2>
            <ul className="space-y-1.5 text-sm text-neutral-300">
              <li><b>OpenF1</b>: timing, telemetry, positions, radio, weather, race control. Past sessions are free; data <i>during</i> a live session needs a paid OpenF1 account.</li>
              <li><b>Jolpica-F1</b>: results and standings back to 1950.</li>
              <li><b>FIA documents</b>: stewards&apos; decisions, engine parts, parc fermé.</li>
              <li><b>MultiViewer</b>: corner positions, pit-lane time loss and the TV map orientation.</li>
              <li><b>Open-Meteo</b>: weather forecasts. <b>Sketchfab</b>: 3D car models. <b>Publisher RSS feeds</b>: news.</li>
            </ul>
            <h3 className="mt-4 font-semibold">Good to know</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-400">
              <li>The free OpenF1 tier allows 30 requests a minute, so the first load of a heavy page can take a few seconds. After that it&apos;s cached.</li>
              <li>Tyre wear, strategy, favourites and clipping are estimates from public data. Teams have far more information than this.</li>
              <li>Telemetry is sampled about 4 times a second, so braking points are accurate to roughly ±20 m.</li>
              <li>Corner names are a hand-made list for classic circuits. Other circuits show numbers only.</li>
              <li>Unofficial fan site, not associated with Formula 1 or the FIA.</li>
            </ul>
          </section>

          <section id="keys" className="card scroll-mt-24">
            <h2 className="mb-3 font-display text-2xl font-bold uppercase">Shortcuts & handy tricks</h2>
            <ul className="space-y-1.5 text-sm text-neutral-300">
              <li><kbd className="rounded border border-neutral-700 bg-neutral-900 px-1.5 font-mono text-xs">Esc</kbd> closes a full-size map or 3D view.</li>
              <li>Pit Wall and 3D Cars links can be shared: the address remembers the drivers, laps or team you picked.</li>
              <li>Hover over column headers, chips and corner markers for an explanation of what they mean.</li>
              <li>Toasts disappear after 12 seconds, or click ✕ to close them sooner.</li>
              <li>If your computer has &quot;reduce motion&quot; switched on, 3D models start still; press the rotate button to spin them.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
