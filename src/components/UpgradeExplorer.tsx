"use client";
import { useMemo, useRef, useState } from "react";
import { ExternalLink, ScanSearch, X } from "lucide-react";
import { AREA_ORDER, carArea } from "@/lib/car-specs";
import type { Upgrade } from "@/lib/upgrades-parse";
import { splitReason } from "@/lib/upgrades-parse";

export type ExplorerEvent = { eventId: string; event: string; path: string; pages: number[]; updates: Upgrade[] };

const KIND_STYLE: Record<string, string> = {
  Performance: "bg-emerald-500/15 text-emerald-300", "Circuit specific": "bg-sky-500/15 text-sky-300",
  Reliability: "bg-amber-500/15 text-amber-300", "Cooling range": "bg-cyan-500/15 text-cyan-300",
};

// Plan view of a generic 2026 car, nose left (our own simplified drawing). Each shape belongs to one area of AREA_ORDER.
const SHAPES: { area: string; d: string; label?: [number, number] }[] = [
  { area: "Floor", d: "M170 70 Q200 52 260 50 L470 56 Q500 60 505 75 L505 165 Q500 180 470 184 L260 190 Q200 188 170 170 Z", label: [205, 64] },
  { area: "Sidepods & cooling", d: "M228 74 Q300 60 362 72 Q420 90 456 106 L456 134 Q420 150 362 168 Q300 180 228 166 Z", label: [330, 82] },
  { area: "Bodywork", d: "M170 102 L300 93 Q330 90 362 97 L484 109 L484 131 L362 143 Q330 150 300 147 L170 138 Z", label: [400, 123] },
  { area: "Diffuser", d: "M505 78 L548 87 L548 153 L505 162 Z", label: [526, 124] },
  { area: "Front wing & nose", d: "M64 107 L172 100 L172 140 L64 133 Z" },
  { area: "Front wing & nose", d: "M18 40 Q40 34 64 38 L66 202 Q40 206 18 200 Z", label: [41, 124] },
  { area: "Front corner", d: "M110 14 h62 a10 10 0 0 1 10 10 v24 a10 10 0 0 1 -10 10 h-62 a10 10 0 0 1 -10 -10 v-24 a10 10 0 0 1 10 -10 Z", label: [141, 40] },
  { area: "Front corner", d: "M110 182 h62 a10 10 0 0 1 10 10 v24 a10 10 0 0 1 -10 10 h-62 a10 10 0 0 1 -10 -10 v-24 a10 10 0 0 1 10 -10 Z" },
  { area: "Rear corner", d: "M470 8 h70 a10 10 0 0 1 10 10 v30 a10 10 0 0 1 -10 10 h-70 a10 10 0 0 1 -10 -10 v-30 a10 10 0 0 1 10 -10 Z", label: [505, 37] },
  { area: "Rear corner", d: "M470 182 h70 a10 10 0 0 1 10 10 v30 a10 10 0 0 1 -10 10 h-70 a10 10 0 0 1 -10 -10 v-30 a10 10 0 0 1 10 -10 Z" },
  { area: "Rear wing", d: "M556 58 h40 v124 h-40 Z", label: [576, 124] },
];

/** Clickable plan view: each area coloured by how many parts the team changed there. */
function CarDiagram({ counts, colour, selected, onPick }: {
  counts: Record<string, number>; colour: string; selected: string | null; onPick: (a: string | null) => void;
}) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <svg viewBox="0 0 610 240" className="w-full" role="group" aria-label="Car areas: click one to filter the upgrades">
      {/* suspension arms (decoration) */}
      <path d="M140 58 L178 104 M150 58 L190 100 M140 182 L178 136 M150 182 L190 140 M500 58 L470 100 M510 58 L486 104 M500 182 L470 140 M510 182 L486 136" stroke="#3f3f46" strokeWidth={3} />
      {SHAPES.map((s, i) => {
        const n = counts[s.area] ?? 0, on = selected === s.area;
        return (
          <path key={i} d={s.d} role="button" tabIndex={0} aria-pressed={on} aria-label={`${s.area}: ${n} part${n === 1 ? "" : "s"}`}
            onClick={() => onPick(on ? null : s.area)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(on ? null : s.area))}
            fill={n ? colour : "#1f1f23"} fillOpacity={n ? 0.18 + 0.72 * (n / max) : 1}
            stroke={on ? "#fff" : "#52525b"} strokeWidth={on ? 2.5 : 1} className="cursor-pointer outline-none transition-[fill-opacity] hover:brightness-125 focus-visible:stroke-white">
            <title>{`${s.area}: ${n} part${n === 1 ? "" : "s"}`}</title>
          </path>
        );
      })}
      <ellipse cx={285} cy={120} rx={26} ry={13} fill="#0b0b0d" stroke="#52525b" pointerEvents="none" />
      {SHAPES.filter((s) => s.label && counts[s.area]).map((s) => (
        <text key={s.area} x={s.label![0]} y={s.label![1]} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff" pointerEvents="none"
          style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 3 }}>{counts[s.area]}</text>
      ))}
      <text x={30} y={232} fontSize={10} fill="#71717a">← front</text>
      <text x={580} y={232} fontSize={10} fill="#71717a" textAnchor="end">rear →</text>
    </svg>
  );
}

/** The FIA's own drawing of the car with red marks where the parts are, rendered in the browser on demand. */
function FiaDrawing({ path, pages }: { path: string; pages: number[] }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const box = useRef<HTMLDivElement>(null);
  const show = async () => {
    setState("loading");
    try {
      const { getDocumentProxy } = await import("unpdf"); // pdf.js, loaded only when someone asks for a drawing
      const res = await fetch(`/api/fia-pdf?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(String(res.status));
      const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
      box.current!.replaceChildren();
      for (const n of pages) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(2, 1400 / base.width) });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        canvas.className = "w-full rounded-lg bg-white";
        canvas.setAttribute("aria-label", "FIA drawing of the car with the updated parts circled");
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas } as Parameters<typeof page.render>[0]).promise;
        box.current!.appendChild(canvas);
      }
      setState("done");
    } catch {
      setState("error");
    }
  };
  return (
    <div className="mt-2">
      {state === "idle" && <button className="pill flex items-center gap-1 text-xs" onClick={show}><ScanSearch size={12} />Show where on the car (FIA drawing)</button>}
      {state === "loading" && <p className="muted animate-pulse text-xs">Loading the FIA document…</p>}
      {state === "error" && <p className="text-xs text-red-400">Couldn&apos;t load the drawing. Open the FIA document instead.</p>}
      <div ref={box} className={state === "done" ? "grid gap-2" : "hidden"} />
      {state === "done" && (
        <button className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500 hover:text-white" onClick={() => { box.current?.replaceChildren(); setState("idle"); }}>
          <X size={11} />Hide drawing
        </button>
      )}
    </div>
  );
}

/** Season grid: car areas down, race weekends across (oldest first), each cell = parts changed in that area that weekend. */
function SeasonCalendar({ events, colour, selected, onPick }: {
  events: ExplorerEvent[]; colour: string; selected: string | null; onPick: (a: string | null) => void;
}) {
  const cols = [...events].reverse();
  const cell = (e: ExplorerEvent, a: string) => e.updates.filter((u) => carArea(u.component) === a).length;
  const max = Math.max(1, ...cols.flatMap((e) => AREA_ORDER.map((a) => cell(e, a))));
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-[10px]">
        <thead>
          <tr>
            <th />
            {cols.map((e) => (
              <th key={e.eventId} className="h-24 align-bottom font-normal text-neutral-400">
                <span className="inline-block whitespace-nowrap [writing-mode:vertical-rl] rotate-180" title={e.event}>{e.event.replace(/ Grand Prix.*$/, "").replace(/-.*$/, "")}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AREA_ORDER.map((a) => (
            <tr key={a}>
              <th className="pr-2 text-right font-normal">
                <button onClick={() => onPick(selected === a ? null : a)} className={`whitespace-nowrap hover:text-white ${selected === a ? "text-white" : "text-neutral-400"}`}>{a}</button>
              </th>
              {cols.map((e) => {
                const n = cell(e, a);
                return (
                  <td key={e.eventId} title={`${e.event} · ${a}: ${n} part${n === 1 ? "" : "s"}`}
                    onClick={() => n && onPick(a)} className={`h-6 w-6 min-w-6 rounded text-center font-mono ${n ? "cursor-pointer text-white" : "text-transparent"} ${selected === a ? "ring-1 ring-white/50" : ""}`}
                    style={{ background: n ? `color-mix(in srgb, ${colour} ${Math.round(30 + 70 * (n / max))}%, #18181b)` : "#18181b" }}>{n || ""}</td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th className="pr-2 text-right font-normal text-neutral-500">All parts</th>
            {cols.map((e) => <td key={e.eventId} className="text-center font-mono text-neutral-400">{e.updates.length || "·"}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Car diagram + season timeline; clicking an area of the car filters the timeline to the parts changed there. */
export function UpgradeExplorer({ events, colour }: { events: ExplorerEvent[]; colour: string }) {
  const [area, setArea] = useState<string | null>(null);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) for (const u of e.updates) c[carArea(u.component)] = (c[carArea(u.component)] ?? 0) + 1;
    return c;
  }, [events]);
  const shown = events
    .map((e) => ({ ...e, list: area ? e.updates.filter((u) => carArea(u.component) === area) : e.updates }))
    .filter((e) => !area || e.list.length);

  return (
    <>
      <section className="card">
        <h2 className="h2">Where on the car</h2>
        <p className="muted mb-2 text-xs">Darker = more parts changed there this season. Click an area to see only those upgrades below.</p>
        <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <CarDiagram counts={counts} colour={colour} selected={area} onPick={setArea} />
          <div className="space-y-1">
            {AREA_ORDER.map((a) => (
              <button key={a} onClick={() => setArea(area === a ? null : a)} aria-pressed={area === a}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-neutral-800 ${area === a ? "bg-neutral-800 ring-1 ring-white/40" : ""}`}>
                <span className="h-3 w-3 rounded-sm" style={{ background: counts[a] ? colour : "#1f1f23", opacity: counts[a] ? 0.35 + 0.65 * (counts[a] / Math.max(1, ...Object.values(counts))) : 1 }} />
                <span className="flex-1 text-neutral-300">{a}</span><span className="font-mono">{counts[a] ?? 0}</span>
              </button>
            ))}
            {area && <button className="mt-1 text-[11px] text-neutral-500 hover:text-white" onClick={() => setArea(null)}>Show all areas</button>}
          </div>
        </div>
        <h3 className="mb-1 mt-4 text-xs font-semibold text-neutral-300">Season calendar: which areas changed at which race</h3>
        <SeasonCalendar events={events} colour={colour} selected={area} onPick={setArea} />
      </section>

      <section className="card">
        <h2 className="h2">Upgrade timeline{area ? `: ${area}` : ""}</h2>
        <p className="muted mb-3 text-xs">Newest first, in the team&apos;s own words. &ldquo;Show where on the car&rdquo; opens the FIA&apos;s drawing with the changed parts circled.</p>
        {!shown.length && <p className="muted text-sm">No parts in this area this season.</p>}
        <ol className="space-y-3">
          {shown.map((e) => (
            <li key={e.eventId} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                <b>{e.event}</b>
                <span className="muted text-xs">{e.list.length ? `${e.list.length} part${e.list.length > 1 ? "s" : ""}` : "no new parts"}</span>
                <a href={`https://www.fia.com${e.path}`} target="_blank" rel="noreferrer" className="link ml-auto inline-flex items-center gap-1 text-xs">FIA document <ExternalLink size={11} /></a>
              </div>
              {e.list.length > 0 && (
                <ul className="space-y-2">
                  {e.list.map((u, i) => {
                    const r = splitReason(u.reason);
                    return (
                      <li key={i} className="text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300 hover:bg-neutral-700" onClick={() => setArea(carArea(u.component))}>{carArea(u.component)}</button>
                          <b className="text-neutral-100">{u.component}</b>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${KIND_STYLE[r.kind] ?? "bg-neutral-800"}`}>{r.kind}{r.detail ? ` · ${r.detail}` : ""}</span>
                        </div>
                        {u.change && <div className="mt-0.5 text-neutral-300">{u.change}</div>}
                        {u.description && <div className="mt-0.5 text-neutral-500">{u.description}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {e.list.length > 0 && e.pages.length > 1 && <FiaDrawing path={e.path} pages={e.pages.slice(1)} />}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
