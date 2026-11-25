"use client";
import { useEffect, useRef, useState } from "react";
import { GripVertical, Lock, Maximize2, Minimize2, RotateCcw, Unlock, X } from "lucide-react";
import { pushApart } from "@/lib/layout";
import { useFullSize } from "./useFullSize";

export type DashBox = { id: string; x: number; y: number; w: number; h: number; z: number };
type Widget = { title: string; minW: number; minH: number; render: (box: DashBox) => React.ReactNode };

const GRID = 10;
const snap = (v: number) => Math.round(v / GRID) * GRID;

/**
 * Free-form canvas: every widget can be dragged by its title bar, resized from its bottom-right corner, brought to the
 * front by clicking it, nudged with the arrow keys (Shift = resize) and closed with ✕. Positions snap to a 10 px grid.
 * Works with mouse, pen and touch (pointer events + pointer capture).
 */
export function DashCanvas({ boxes, onChange, widgets, locked }: {
  boxes: DashBox[]; onChange: (b: DashBox[]) => void; widgets: Record<string, Widget>; locked: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  // `all` = every panel as it was when the drag started: pushes are recomputed from it, so panels slide back if you move away
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; box: DashBox; all: DashBox[]; z: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // keep widgets inside the canvas when the window gets narrower
  const fit = (b: DashBox): DashBox => {
    const w = Math.min(b.w, width);
    return { ...b, w, x: Math.max(0, Math.min(b.x, width - w)), y: Math.max(0, b.y) };
  };
  // apply a change to one panel, then push any panel it now overlaps down out of the way
  const update = (id: string, patch: Partial<DashBox>, base = boxes) =>
    onChange(pushApart(base.map((b) => (b.id === id ? fit({ ...b, ...patch }) : b)), id));
  // a tie still loses to whichever panel comes later in the page, so the front panel must be strictly highest
  const frontZ = (id: string) => {
    const me = boxes.find((b) => b.id === id), top = Math.max(0, ...boxes.map((b) => b.z));
    return me && boxes.some((o) => o.id !== id && o.z >= me.z) ? top + 1 : me?.z ?? top + 1;
  };
  const toFront = (id: string) => {
    const z = frontZ(id);
    if (z !== boxes.find((b) => b.id === id)?.z) onChange(boxes.map((b) => (b.id === id ? { ...b, z } : b)));
  };

  const start = (e: React.PointerEvent, b: DashBox, mode: "move" | "resize") => {
    if (locked || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: b.id, mode, sx: e.clientX, sy: e.clientY, box: b, all: boxes, z: frontZ(b.id) };
    setActive(b.id);
    toFront(b.id);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy, wd = widgets[d.id];
    if (d.mode === "move") update(d.id, { x: snap(d.box.x + dx), y: snap(d.box.y + dy), z: d.z }, d.all);
    else update(d.id, { w: Math.max(wd.minW, snap(d.box.w + dx)), h: Math.max(wd.minH, snap(d.box.h + dy)), z: d.z }, d.all);
  };
  const end = () => { drag.current = null; setActive(null); };

  const key = (e: React.KeyboardEvent, b: DashBox) => {
    if (locked) return;
    const step = GRID * (e.altKey ? 1 : 2), wd = widgets[b.id];
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();
    if (e.shiftKey) update(b.id, { w: Math.max(wd.minW, b.w + d[0]), h: Math.max(wd.minH, b.h + d[1]) });
    else update(b.id, { x: b.x + d[0], y: b.y + d[1] });
  };

  // squeezing panels into a narrower window can stack them on each other: settle on screen (the saved layout is untouched)
  const fitted = boxes.filter((b) => widgets[b.id]).map(fit);
  const anchor = active ?? [...fitted].sort((a, b) => a.y - b.y || a.x - b.x)[0]?.id;
  const shown = anchor ? pushApart(fitted, anchor) : fitted;
  const height = Math.max(600, ...shown.map((b) => b.y + b.h + 240));

  return (
    <div ref={ref} className="relative w-full rounded-2xl border border-neutral-800"
      style={{ height, backgroundColor: "#0b0b0d", backgroundImage: "radial-gradient(#27272a 1px, transparent 1px)", backgroundSize: `${GRID * 2}px ${GRID * 2}px` }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {shown.map((b) => {
        const wd = widgets[b.id];
        return (
          <section key={b.id} aria-label={wd.title} onPointerDown={() => toFront(b.id)}
            className={`absolute flex flex-col overflow-hidden rounded-xl border has-[[data-fullsize]]:!z-[70] bg-[#111113] shadow-2xl ${active === b.id ? "border-red-500/70" : "border-neutral-800"}`}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h, zIndex: b.z }}>
            <header tabIndex={0} onPointerDown={(e) => start(e, b, "move")} onKeyDown={(e) => key(e, b)}
              title={locked ? wd.title : "Drag to move · arrow keys to move · Shift+arrows to resize"}
              className={`flex h-8 shrink-0 select-none items-center gap-1.5 border-b border-neutral-800 bg-neutral-900/80 px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${locked ? "" : "cursor-grab active:cursor-grabbing"}`}>
              {!locked && <GripVertical size={13} className="text-neutral-500" />}
              <span className="truncate">{wd.title}</span>
              {!locked && (
                <button aria-label={`Remove ${wd.title}`} className="ml-auto grid h-5 w-5 place-items-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-white"
                  onPointerDown={(e) => e.stopPropagation()} onClick={() => onChange(boxes.filter((x) => x.id !== b.id))}>
                  <X size={12} />
                </button>
              )}
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-2">{wd.render(b)}</div>
            {!locked && (
              <div role="presentation" onPointerDown={(e) => start(e, b, "resize")} title="Drag to resize"
                className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
                style={{ background: "linear-gradient(135deg, transparent 50%, #52525b 50%)" }} />
            )}
          </section>
        );
      })}
      {!shown.length && <p className="muted absolute inset-0 grid place-items-center text-sm">The canvas is empty. Use “Add widget” above.</p>}
    </div>
  );
}

/** Canvas layout saved per browser under `key`; layouts saved before panels pushed each other are settled on load. */
export function useCanvasLayout(key: string, initial: DashBox[]) {
  const [boxes, setBoxes] = useState<DashBox[]>(initial);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (!s) return;
      const saved: DashBox[] = JSON.parse(s);
      const top = [...saved].sort((a, b) => a.y - b.y || a.x - b.x)[0];
      setBoxes(top ? pushApart(saved, top.id) : saved);
    } catch { /* storage blocked: keep default */ }
  }, [key]);
  const save = (b: DashBox[]) => { setBoxes(b); try { localStorage.setItem(key, JSON.stringify(b)); } catch { /* not saved */ } };
  return { boxes, save };
}

/** Toolbar + canvas that can fill the whole screen; `bar` (e.g. the replay controls) is shown only in full screen. */
export function CanvasFrame({ tools, bar, children }: { tools: React.ReactNode; bar?: React.ReactNode; children: React.ReactNode }) {
  const fs = useFullSize<HTMLDivElement>();
  return (
    <div ref={fs.ref} className={fs.full ? "fixed inset-0 z-[80] space-y-3 overflow-auto bg-[#08080a] p-3" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-2">
        {tools}
        <button className={`pill flex items-center gap-1 ${fs.full ? "pill-on" : ""}`} onClick={fs.toggle} title={fs.full ? "Esc also exits" : "Fill the screen with the canvas"}>
          {fs.full ? <Minimize2 size={12} /> : <Maximize2 size={12} />}{fs.full ? "Exit full screen" : "Full screen"}
        </button>
      </div>
      {fs.full && bar}
      {children}
    </div>
  );
}

/** Add widget / lock / reset controls for a canvas. */
export function CanvasToolbar({ boxes, save, initial, widgets, sizes, locked, setLocked }: {
  boxes: DashBox[]; save: (b: DashBox[]) => void; initial: DashBox[]; widgets: Record<string, { title: string }>;
  sizes: Record<string, [number, number]>; locked: boolean; setLocked: (f: (l: boolean) => boolean) => void;
}) {
  const missing = Object.keys(widgets).filter((id) => !boxes.some((b) => b.id === id));
  const add = (id: string) => {
    const bottom = Math.max(0, ...boxes.map((b) => b.y + b.h));
    const [w, h] = sizes[id] ?? [400, 300];
    save([...boxes, { id, x: 0, y: bottom + 10, w, h, z: Math.max(0, ...boxes.map((b) => b.z)) + 1 }]);
  };
  return (
    <>
      <select className="select" value="" aria-label="Add widget" disabled={!missing.length} onChange={(e) => e.target.value && add(e.target.value)}>
        <option value="">{missing.length ? "+ Add widget…" : "All widgets on canvas"}</option>
        {missing.map((id) => <option key={id} value={id}>{widgets[id].title}</option>)}
      </select>
      <button className={`pill flex items-center gap-1 ${locked ? "pill-on" : ""}`} onClick={() => setLocked((l) => !l)}>
        {locked ? <Lock size={12} /> : <Unlock size={12} />}{locked ? "Locked" : "Lock layout"}
      </button>
      <button className="pill flex items-center gap-1" onClick={() => save(initial)}><RotateCcw size={12} />Reset layout</button>
    </>
  );
}
