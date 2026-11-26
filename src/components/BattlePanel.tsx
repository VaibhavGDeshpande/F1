"use client";
import { Learn } from "./Learn";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Crosshair } from "lucide-react";
import type { TowerRow } from "@/lib/live";
import { trend } from "@/lib/strategy";
import { TelemetryChart } from "./Charts";
import { toast } from "./Toaster";

/** Gap between two chosen drivers, lap by lap, with a toast when the one behind gets within a second. */
export function BattlePanel({ sessionKey, t, tower, bare = false }: { sessionKey: number; t: string; tower: TowerRow[]; bare?: boolean }) {
  const [pair, setPair] = useState<[number, number] | null>(null);
  const [gaps, setGaps] = useState<{ lap: number; gap: number }[]>([]);
  const toasted = useRef<string>("");

  // default: P2 chasing P1; reset when the session changes
  useEffect(() => { setPair(null); setGaps([]); }, [sessionKey]);
  useEffect(() => {
    if (!pair && tower.length > 1 && tower[0].position && tower[1].position) setPair([tower[0].driver_number, tower[1].driver_number]);
  }, [pair, tower]);

  // refetch only when one of the two completes a lap
  const lapKey = pair ? pair.map((n) => tower.find((r) => r.driver_number === n)?.lap ?? 0).join(":") : "";
  useEffect(() => {
    if (!pair) return;
    let gone = false;
    fetch(`/api/battle?session_key=${sessionKey}&a=${pair[0]}&b=${pair[1]}&t=${encodeURIComponent(t)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((g: { lap: number; gap: number }[]) => {
        if (gone) return;
        setGaps((prev) => {
          const last = g.at(-1), before = g.at(-2), code = (n: number) => tower.find((r) => r.driver_number === n)?.acronym ?? n;
          const id = `${pair.join("-")}@${last?.lap}`;
          // toast once when the chaser comes within 1 s, only for a newly completed lap (not on first load / pair change)
          if (prev.length && last && before && Math.abs(last.gap) < 1 && Math.abs(before.gap) >= 1 && toasted.current !== id) {
            toasted.current = id;
            const [ahead, behind] = last.gap >= 0 ? pair : [pair[1], pair[0]];
            toast({ id, tone: "amber", title: "Battle", body: `${code(behind)} is within a second of ${code(ahead)} (${Math.abs(last.gap).toFixed(2)} s, lap ${last.lap})` });
          }
          return g;
        });
      })
      .catch(() => {});
    return () => { gone = true; };
  }, [sessionKey, pair?.[0], pair?.[1], lapKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pair) return null;
  const [a, b] = pair.map((n) => tower.find((r) => r.driver_number === n));
  const last = gaps.at(-1), tr = trend(gaps);
  const pick = (i: 0 | 1, n: number) => { setGaps([]); setPair((p) => (p ? (i ? [p[0], n] : [n, p[1]]) as [number, number] : p)); };
  const select = (i: 0 | 1) => (
    <select className="select py-1" value={pair[i]} onChange={(e) => pick(i, Number(e.target.value))} aria-label={i ? "Second driver" : "First driver"}>
      {tower.map((r) => <option key={r.driver_number} value={r.driver_number}>{r.position ? `P${r.position} ` : ""}{r.acronym}</option>)}
    </select>
  );

  return (
    <section className={bare ? "space-y-2" : "card space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="h2 mb-0 mr-2"><Crosshair size={14} />Battle</h2>
        {select(0)}
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-700 hover:bg-neutral-800" aria-label="Swap drivers" onClick={() => { setGaps([]); setPair([pair[1], pair[0]]); }}>
          <ArrowLeftRight size={14} />
        </button>
        {select(1)}
        <Learn className="w-full" look="pick two cars about a second apart and see whether the trend line is falling (chaser closing) or flat (stuck behind).">
          The gap over the last laps shows who is faster right now. Within 1 s the chaser can use overtake mode (extra battery energy) on the straights. Closing on a car and passing are different
          things: following closely in dirty air wears the chaser&apos;s tyres faster.
        </Learn>
      </div>
      {a && b && last ? (
        <>
          <p className="text-sm">
            <b style={{ color: b.colour }}>{b.acronym}</b> is <b className="font-mono">{Math.abs(last.gap).toFixed(2)} s</b> {last.gap >= 0 ? "behind" : "ahead of"}{" "}
            <b style={{ color: a.colour }}>{a.acronym}</b> after lap {last.lap}
            {tr != null && Math.abs(tr) >= 0.05 && (
              <span className={(last.gap >= 0) === (tr < 0) ? "text-amber-300" : "text-neutral-400"}>
                {" "}· gap {tr < 0 ? "shrinking" : "growing"} {Math.abs(tr).toFixed(2)} s/lap
              </span>
            )}
          </p>
          <TelemetryChart xLabel="lap" xTitle="Lap" yTitle="Gap (s)" unit="s" height={170} lines={[{ name: "gap", colour: b.colour, data: gaps.map((g) => ({ x: g.lap, y: g.gap })) }]} />
          <p className="muted text-[11px]">Seconds {b.acronym} crossed the line after {a.acronym} at the end of each lap (below 0 = {b.acronym} ahead). A toast fires when the gap drops under 1 s.</p>
        </>
      ) : <p className="muted text-sm">Waiting for both drivers to complete a lap…</p>}
    </section>
  );
}
