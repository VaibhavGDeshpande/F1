"use client";
import { useEffect, useMemo, useState } from "react";
import { deltaTrace, fmtLap, type TelPoint } from "@/lib/analysis";
import { Traces } from "./LapTraces";
import type { LiveFeed } from "./useLiveFeed";

type LapRow = { lap: number; time: number; out?: boolean };
type Choice = "latest" | "fastest" | number;
type Tel = { points: TelPoint[]; frozen?: number };

const rgbDist = (a: string, b: string) => {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [c(a), c(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
const fastestOf = (laps: LapRow[]) => laps.reduce<LapRow | undefined>((a, l) => (!l.out && (!a || l.time < a.time) ? l : a), undefined);
const resolve = (laps: LapRow[], c: Choice) =>
  c === "latest" ? laps.at(-1) : c === "fastest" ? fastestOf(laps) : laps.find((l) => l.lap === c);

/** One side of the comparison: the driver's laps completed so far (refetched each time the tower shows a new lap). */
function useLaps(f: LiveFeed, n: number | null) {
  const [laps, setLaps] = useState<LapRow[]>([]);
  const key = f.session?.session_key, towerLap = f.data?.tower.find((r) => r.driver_number === n)?.lap;
  const t = f.isLive ? null : f.data?.t;
  useEffect(() => {
    if (key == null || n == null) return;
    const qs = new URLSearchParams({ session_key: String(key), driver: String(n) });
    if (t) qs.set("t", t);
    let stale = false;
    fetch(`/api/laps?${qs}`).then((r) => (r.ok ? r.json() : [])).then((j) => !stale && setLaps(j)).catch(() => {});
    return () => { stale = true; };
  }, [key, n, towerLap]); // eslint-disable-line react-hooks/exhaustive-deps -- t only matters when a lap completes
  return laps;
}

/** Pit Wall-style overlay of two completed laps (speed, throttle, brake, gear, rpm and the time delta) for the Live page. */
export function LapCompare({ f }: { f: LiveFeed }) {
  const tower = f.data?.tower ?? [];
  const [pickA, setA] = useState<number | null>(null), [pickB, setB] = useState<number | null>(null);
  const [choiceA, setChoiceA] = useState<Choice>("latest"), [choiceB, setChoiceB] = useState<Choice>("latest");
  const a = pickA ?? tower[0]?.driver_number ?? null, b = pickB ?? tower[1]?.driver_number ?? null;
  const lapsA = useLaps(f, a), lapsB = useLaps(f, b);
  const lapA = resolve(lapsA, choiceA), lapB = resolve(lapsB, choiceB);

  // telemetry per driver:lap, fetched once each (completed laps never change)
  const [tel, setTel] = useState<Record<string, Tel | "error">>({});
  const sk = f.session?.session_key;
  useEffect(() => setTel({}), [sk]);
  useEffect(() => {
    for (const [n, l] of [[a, lapA], [b, lapB]] as const) {
      const id = `${n}:${l?.lap}`;
      if (n == null || !l || sk == null || id in tel) continue;
      setTel((x) => ({ ...x, [id]: { points: [] } }));
      fetch(`/api/telemetry?session_key=${sk}&driver=${n}&lap=${l.lap}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j) => setTel((x) => ({ ...x, [id]: { points: j.points, frozen: j.frozen } })))
        .catch(() => setTel((x) => ({ ...x, [id]: "error" })));
    }
  }, [a, b, lapA?.lap, lapB?.lap, sk]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = (n: number | null) => tower.find((r) => r.driver_number === n);
  const rA = row(a), rB = row(b);
  const tA = tel[`${a}:${lapA?.lap}`], tB = tel[`${b}:${lapB?.lap}`];
  const okA = tA && tA !== "error" && tA.points.length ? tA : null, okB = tB && tB !== "error" && tB.points.length ? tB : null;
  // same team, same driver or look-alike colours (Mercedes teal vs Red Bull blue) would be hard to tell apart
  const colA = rA?.colour ?? "#fff", colB = !rB || rgbDist(rB.colour, colA) < 120 ? "#ffffff" : rB.colour;
  const nameA = `${rA?.acronym ?? "?"} L${lapA?.lap ?? "–"}`, nameB = `${rB?.acronym ?? "?"} L${lapB?.lap ?? "–"}`;

  const shown = useMemo(() => [okA && { code: nameA, colour: colA, points: okA.points }, okB && { code: nameB, colour: colB, points: okB.points }].filter(Boolean) as { code: string; colour: string; points: TelPoint[] }[],
    [okA, okB, nameA, nameB, colA, colB]);
  const deltas = useMemo(() => (okA && okB ? [{ code: nameB, colour: colB, data: deltaTrace(okA.points, okB.points) }] : []), [okA, okB, nameB, colB]);
  const maxD = okA?.points.at(-1)?.d ?? okB?.points.at(-1)?.d ?? 5000;

  const side = (label: string, n: number | null, set: (n: number) => void, laps: LapRow[], c: Choice, setC: (c: Choice) => void, colour: string) => (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 text-xs" style={{ borderColor: colour }}>
      <span className="text-neutral-400">{label}</span>
      <select className="rounded bg-neutral-900 px-1 py-0.5 font-mono" value={n ?? ""} aria-label={`Driver ${label}`} onChange={(e) => set(Number(e.target.value))}>
        {tower.map((r) => <option key={r.driver_number} value={r.driver_number}>{r.acronym}</option>)}
      </select>
      <select className="rounded bg-neutral-900 px-1 py-0.5 font-mono" value={String(c)} aria-label={`Lap ${label}`}
        onChange={(e) => setC(e.target.value === "latest" || e.target.value === "fastest" ? e.target.value : Number(e.target.value))}>
        <option value="latest">Latest lap{laps.length ? ` (L${laps.at(-1)!.lap})` : ""}</option>
        <option value="fastest">Fastest so far{fastestOf(laps) ? ` (L${fastestOf(laps)!.lap})` : ""}</option>
        {[...laps].reverse().map((l) => <option key={l.lap} value={l.lap}>Lap {l.lap} · {fmtLap(l.time)}{l.out ? " · out-lap" : ""}</option>)}
      </select>
      {laps.length > 0 && <span className="font-mono text-neutral-300">{fmtLap(resolve(laps, c)?.time)}</span>}
    </div>
  );

  if (!tower.length) return <p className="muted text-sm">Waiting for timing data…</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {side("A", a, setA, lapsA, choiceA, setChoiceA, colA)}
        {side("B", b, setB, lapsB, choiceB, setChoiceB, colB)}
      </div>
      {[[okA, nameA], [okB, nameB]].map(([t, name]) => t && typeof t === "object" && (t.frozen ?? 0) >= 2 && (
        <p key={String(name)} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">⚠ {String(name)}: the data feed froze for {Math.round(t.frozen!)} s, so its speed line is flat there.</p>
      ))}
      {!lapA && !lapB ? <p className="muted py-6 text-center text-sm">No completed laps yet. Lines appear once a lap is finished.</p>
        : tA === "error" || tB === "error" ? <p className="text-sm text-red-400">Telemetry isn&apos;t available for {tA === "error" ? nameA : nameB} yet.</p>
        : !shown.length ? <p className="muted py-6 text-center text-sm">Loading telemetry…</p>
        : <Traces shown={shown} deltas={deltas} refCode={nameA} maxD={maxD} />}
    </div>
  );
}
