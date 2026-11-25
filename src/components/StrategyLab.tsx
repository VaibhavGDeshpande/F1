"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { Beaker, Copy, Plus, Star, X } from "lucide-react";
import { compoundColour } from "@/lib/openf1";
import { COMPOUNDS, monteCarlo, planProblems, planTime, stintBreakdown, strategyName, type Compound, type SimInput, type Strategy } from "@/lib/racesim";
import { Learn } from "./Learn";

const label = (c: Compound) => c[0] + c.slice(1).toLowerCase();
const sign = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} s`;

/** Stint bar: one coloured block per set of tyres; optional white pit windows. */
export function StintBar({ r, laps }: { r: { seq: Compound[]; stops: number[]; window?: [number, number][] }; laps: number }) {
  const edges = [0, ...r.stops, laps];
  return (
    <div className="relative flex h-3 w-full overflow-hidden rounded bg-neutral-900">
      {r.seq.map((c, i) => (
        <div key={i} className="h-full border-r border-black/70 last:border-0" title={`${label(c)} · laps ${edges[i] + 1}–${edges[i + 1]}`}
          style={{ width: `${(Math.max(0, edges[i + 1] - edges[i]) / laps) * 100}%`, background: compoundColour(c) }} />
      ))}
      {r.window?.map(([a, b], i) => (
        <div key={`w${i}`} className="absolute inset-y-0 border-x border-white/80 bg-white/15" style={{ left: `${(a / laps) * 100}%`, width: `${(Math.max(1, b - a) / laps) * 100}%` }} />
      ))}
    </div>
  );
}

type Try = { name: string; stops: number[]; gap: number; avg: number | null };

/** Build your own plan, see exactly where it loses time against the optimiser's best, and keep a log of attempts. */
export function StrategyLab({ inp, best, runs }: { inp: SimInput; best?: Strategy; runs: number }) {
  const laps = inp.laps;
  const [seq, setSeq] = useState<Compound[]>(["SOFT", "HARD"]);
  const [stops, setStops] = useState<number[]>([Math.round(laps / 3)]);
  const [tries, setTries] = useState<Try[]>([]);
  const plan = useDeferredValue(useMemo(() => ({ seq, stops }), [seq, stops]));

  const problems = planProblems(inp, plan.seq, plan.stops);
  const parts = stintBreakdown(inp, plan.seq, plan.stops);
  const time = planTime(inp, plan.seq, plan.stops);
  const gap = best ? time - best.time : 0;
  // same seed as the main table, so both plans meet exactly the same safety cars in each simulated race
  const mc = useMemo(() => {
    if (!best || problems.length) return null;
    const res = monteCarlo(inp, [best, { ...plan, time }], runs);
    const same = (r: Strategy) => r.seq.join() === plan.seq.join() && r.stops.join() === plan.stops.join();
    const mine = res.find(same) ?? res[0], theirs = res.find((r) => !same(r)) ?? mine;
    return { avg: mine.mean - theirs.mean, beats: mine === theirs ? 50 : mine.winPct };
  }, [inp, best, plan, time, runs, problems.length]);

  const setStop = (i: number, v: number) => setStops((s) => s.map((x, j) => (j === i ? Math.round(v) : x)));
  const setTyre = (i: number, c: Compound) => setSeq((s) => s.map((x, j) => (j === i ? c : x)));
  const addStop = () => {
    const from = stops.at(-1) ?? 0;
    setStops([...stops, Math.round((from + laps) / 2)]);
    setSeq([...seq, COMPOUNDS.find((c) => c !== seq.at(-1)) ?? "HARD"]);
  };
  const removeStint = (i: number) => {
    setSeq(seq.filter((_, j) => j !== i));
    setStops(stops.filter((_, j) => j !== Math.max(0, i - 1)));
  };
  const copyBest = () => { if (best) { setSeq([...best.seq]); setStops([...best.stops]); } };
  const logTry = () => setTries((t) => [{ name: strategyName(plan), stops: plan.stops, gap, avg: mc?.avg ?? null }, ...t].slice(0, 12));
  const bestTry = tries.reduce<Try | null>((a, t) => (!a || t.gap < a.gap ? t : a), null);

  // plain-English coaching from the breakdown
  const tips: string[] = [];
  parts.forEach((p, i) => {
    if (p.cliff > 0.05) tips.push(`Stint ${i + 1}: the ${label(p.compound)} runs ${p.overLife} lap${p.overLife > 1 ? "s" : ""} past its life and loses ${p.cliff.toFixed(1)} s on the cliff. Pit earlier, or use a harder tyre.`);
  });
  if (best && !problems.length) {
    if (stops.length > best.stops.length) tips.push(`Each extra stop costs ${inp.pitLoss.toFixed(1)} s in the pit lane. It only pays if fresher tyres win back more than that.`);
    if (stops.length < best.stops.length) tips.push(`Fewer stops saves pit time, but long stints lose it back through wear. The optimiser found ${best.stops.length} stops faster here.`);
    if (gap < 0.3) tips.push("That's the optimum (or within 0.3 s of it). Now try raising the safety car chance or the wear, and see whether the best plan changes.");
    else if (!tips.length) tips.push("Move the stop laps a few laps either way and watch the wear column: you're balancing the tyre stints against each other.");
  }

  const wearPace = (p: (typeof parts)[number]) => p.pace + p.wear;

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="h2 mb-0"><Beaker size={14} />Strategy lab</h2>
        <p className="muted text-xs">Build your own plan and see how close you get to the optimiser. Edit tyres and stop laps; results update as you type.</p>
      </div>
      <Learn title="How to experiment" look="start with Soft → Hard, then move the stop lap 2 laps at a time and log each try. Where is the gap smallest? Then try 2 stops.">
        A race strategy is a trade-off. Every lap on a worn tyre is slower (<b>wear</b>), a tyre run past its life falls off a <b>cliff</b>, and every stop costs
        the <b>pit loss</b>. Short stints mean fresh tyres but more stops; long stints save stops but pay in wear. The best plan balances the stints.
      </Learn>

      <div className="space-y-2">
        {seq.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
            <span className="w-14 text-xs text-neutral-400">Stint {i + 1}</span>
            <div className="flex gap-1">
              {COMPOUNDS.map((k) => (
                <button key={k} onClick={() => setTyre(i, k)} aria-pressed={k === c}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${k === c ? "border-white bg-neutral-800" : "border-neutral-800 text-neutral-400"}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: compoundColour(k) }} />{label(k)}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-neutral-400">laps {i ? stops[i - 1] + 1 : 1} to</span>
            {i < stops.length ? (
              <input type="number" className="select w-20 py-1 font-mono" min={1} max={laps - 1} value={stops[i]} aria-label={`Stint ${i + 1} pit lap`}
                onChange={(e) => Number.isFinite(e.target.valueAsNumber) && setStop(i, e.target.valueAsNumber)} />
            ) : <span className="w-20 px-2 font-mono text-sm">{laps}</span>}
            <button aria-label={`Remove stint ${i + 1}`} disabled={seq.length < 2} onClick={() => removeStint(i)}
              className="grid h-6 w-6 place-items-center rounded text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-30"><X size={12} /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button className="pill flex items-center gap-1" onClick={addStop} disabled={seq.length >= 4}><Plus size={12} />Add a stop</button>
          <button className="pill flex items-center gap-1" onClick={copyBest} disabled={!best}><Copy size={12} />Copy the best plan</button>
          <button className="pill pill-on ml-auto flex items-center gap-1" onClick={logTry} disabled={!!problems.length}><Star size={12} />Log this try</button>
        </div>
        <StintBar r={plan} laps={laps} />
      </div>

      {problems.length ? (
        <ul className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">{problems.map((p) => <li key={p}>⚠ {p}</li>)}</ul>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-neutral-950 p-2">
              <div className={`font-display text-2xl font-bold ${gap < 0.3 ? "text-emerald-400" : gap < 3 ? "text-amber-300" : "text-red-400"}`}>{gap < 0.05 ? "optimal" : sign(gap)}</div>
              <div className="text-[11px] text-neutral-400">vs best plan, clean race</div>
            </div>
            <div className="rounded-xl bg-neutral-950 p-2">
              <div className="font-display text-2xl font-bold">{mc ? sign(mc.avg) : "…"}</div>
              <div className="text-[11px] text-neutral-400">average with safety cars</div>
            </div>
            <div className="rounded-xl bg-neutral-950 p-2">
              <div className="font-display text-2xl font-bold">{mc ? `${mc.beats.toFixed(0)}%` : "…"}</div>
              <div className="text-[11px] text-neutral-400">of races it beats the best plan</div>
            </div>
          </div>

          <table className="tbl text-xs">
            <thead><tr><th>Stint</th><th>Tyre</th><th className="text-right">Laps</th><th className="text-right" title="Compound pace + tyre wear">Pace + wear</th><th className="text-right" title="Extra loss after the tyre's usable life">Cliff</th></tr></thead>
            <tbody>
              {parts.map((p, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: compoundColour(p.compound) }} />{label(p.compound)}</span></td>
                  <td className="text-right font-mono">{p.from}–{p.to} ({p.laps})</td>
                  <td className="text-right font-mono">{wearPace(p).toFixed(1)} s</td>
                  <td className={`text-right font-mono ${p.cliff > 0.05 ? "text-red-400" : "text-neutral-500"}`}>{p.cliff.toFixed(1)} s</td>
                </tr>
              ))}
              <tr><td colSpan={3} className="text-neutral-400">Pit stops ({stops.length} × {inp.pitLoss.toFixed(1)} s)</td><td colSpan={2} className="text-right font-mono">{(stops.length * inp.pitLoss).toFixed(1)} s</td></tr>
            </tbody>
          </table>
          <ul className="space-y-1 text-xs text-neutral-300">{tips.map((t) => <li key={t}>💡 {t}</li>)}</ul>
        </>
      )}

      {tries.length > 0 && (
        <div>
          <div className="mb-1 flex items-center text-xs font-semibold text-neutral-300">Your tries<button className="ml-auto text-[11px] text-neutral-500 hover:text-white" onClick={() => setTries([])}>clear</button></div>
          <ul className="space-y-1 text-xs">
            {tries.map((t, i) => (
              <li key={i} className={`flex gap-2 rounded-lg px-2 py-1 ${t === bestTry ? "bg-emerald-500/10 text-emerald-200" : "bg-neutral-950"}`}>
                <span className="w-4">{t === bestTry ? "★" : ""}</span><b>{t.name}</b><span className="text-neutral-400">stop {t.stops.join(", ")}</span>
                <span className="ml-auto font-mono">{t.gap < 0.05 ? "optimal" : sign(t.gap)}</span>
                <span className="w-24 text-right font-mono text-neutral-400">{t.avg == null ? "" : `${sign(t.avg)} w/ SC`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
