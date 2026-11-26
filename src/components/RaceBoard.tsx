"use client";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { fmtLap } from "@/lib/analysis";
import { xTitle, yTitle } from "./Charts";
import { compoundColour } from "@/lib/openf1";
import type { AeroRow, PitRow } from "@/lib/race-board";
import { tooltip } from "./LapTraces";
import { Learn } from "./Learn";
import type { LiveFeed } from "./useLiveFeed";

type Board = {
  gaps: { lap: number; gaps: Record<number, number> }[];
  tyres: { driver_number: number; compound: string | null; stint: number; age: number; slope: number | null; pace: number | null; laps: number }[];
  pits: PitRow[];
  aero?: AeroRow[];
};

// one request shared by all three widgets, made again each time the leader completes a lap
const cache = new Map<string, Promise<Board | null>>();
function useRaceBoard(f: LiveFeed) {
  const [board, setBoard] = useState<Board | null>(null);
  const sk = f.session?.session_key, lapNow = Math.max(0, ...(f.data?.tower ?? []).map((r) => r.lap ?? 0));
  const hasData = !!f.data;
  useEffect(() => {
    if (sk == null || !f.data) return;
    const key = `${sk}:${lapNow}:${f.isLive}`;
    if (!cache.has(key)) {
      const qs = new URLSearchParams({ session_key: String(sk) });
      if (!f.isLive) qs.set("t", f.data.t);
      cache.set(key, fetch(`/api/race-board?${qs}`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
      if (cache.size > 20) cache.delete(cache.keys().next().value!);
    }
    let stale = false;
    cache.get(key)!.then((b) => { if (!stale && b) setBoard(b); });
    return () => { stale = true; };
  }, [sk, lapNow, f.isLive, hasData]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setBoard(null), [sk]);
  const who = useMemo(() => new Map((f.data?.tower ?? []).map((r) => [r.driver_number, r])), [f.data?.tower]);
  return { board, who };
}

const waiting = (msg = "Waiting for completed laps…") => <p className="muted py-4 text-center text-sm">{msg}</p>;
const label = (c: string | null) => (c ? c[0] + c.slice(1).toLowerCase() : "?");
const Tyre = ({ c }: { c: string | null }) => <span className="inline-block h-2.5 w-2.5 rounded-full align-middle" title={label(c)} style={{ background: c ? compoundColour(c) : "#555" }} />;

/** Gap to the leader after every lap, for the top N cars. Leader on top, like the TV graphic. */
export function GapChart({ f, height }: { f: LiveFeed; height: number }) {
  const { board } = useRaceBoard(f);
  const [top, setTop] = useState(10);
  const [cap, setCap] = useState(true);
  const order = (f.data?.tower ?? []).filter((r) => !r.out).slice(0, top);
  const ids = order.map((r) => r.driver_number).join();
  const data = useMemo(() => (board?.gaps ?? []).map((g) => {
    const row: Record<string, number> = { lap: g.lap };
    for (const r of order) if (g.gaps[r.driver_number] != null) row[r.acronym] = g.gaps[r.driver_number];
    return row;
  }), [board, ids]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!board) return waiting();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1 text-xs">
        {[5, 10, 20].map((n) => <button key={n} className={`chip ${top === n ? "chip-on" : ""}`} onClick={() => setTop(n)}>Top {n}</button>)}
        <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={cap} onChange={(e) => setCap(e.target.checked)} />Cap at 60 s</label>
      </div>
      <Learn look="watch a line jump down by ~20 s: that's a pit stop. Lines bunching together at the top = a safety car.">
        Each line is a driver&apos;s gap to the leader when they crossed the line. Lines converging means the car is catching; diverging means dropping back.
      </Learn>
      <ResponsiveContainer width="100%" height={Math.max(160, height)}>
        <LineChart data={data} margin={{ top: 4, right: 36, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1d1d1f" vertical={false} />
          <XAxis dataKey="lap" stroke="#555" fontSize={10} height={32} label={xTitle("Lap")} />
          <YAxis reversed width={52} stroke="#555" fontSize={10} domain={[0, cap ? 60 : "auto"]} allowDataOverflow={cap} tickFormatter={(v: number) => `+${v}`}
            label={yTitle("Gap to leader (s)")} />
          <Tooltip {...tooltip} labelFormatter={(l) => `Lap ${l}`} formatter={(v) => `+${Number(v).toFixed(1)} s`} itemSorter={(i) => Number(i.value)} />
          {order.map((r) => (
            <Line key={r.driver_number} dataKey={r.acronym} stroke={r.colour} dot={false} strokeWidth={1.4} isAnimationActive={false} connectNulls
              label={(p: { index?: number; x?: number | string; y?: number | string }) => (p.index === data.length - 1 && p.x != null && p.y != null
                ? <text key={r.acronym} x={Number(p.x) + 3} y={Number(p.y) + 3} fontSize={9} fill={r.colour}>{r.acronym}</text> : <g key={`${r.acronym}-${p.index}`} />)} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Each driver's current tyres: age and how much time they lose per lap of wear (fuel-corrected fit over clean laps). */
export function TyreDeg({ f }: { f: LiveFeed }) {
  const { board, who } = useRaceBoard(f);
  if (!board) return waiting();
  const rows = board.tyres.filter((t) => who.has(t.driver_number)).sort((a, b) => (b.slope ?? -9) - (a.slope ?? -9));
  const max = Math.max(0.15, ...rows.map((r) => r.slope ?? 0));
  return (
    <div className="space-y-2">
      <Learn look="a driver at the top of this list with old tyres is the next one likely to pit. Compare the same compound across teams.">
        Seconds lost per lap as the tyre wears, after removing the gain from burning fuel. Above ~0.1 s/lap the tyre is fading; old tyres with a high number
        are close to a stop. Needs 3 clean laps on the set (no pit, safety car or traffic-wrecked laps).
      </Learn>
      <table className="tbl text-xs">
        <thead><tr><th>Driver</th><th>Tyre</th><th className="text-right">Age</th><th>Wear (s/lap)</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const d = who.get(r.driver_number)!;
            return (
              <tr key={r.driver_number}>
                <td className="font-mono"><span className="mr-1 inline-block h-3 w-1 rounded align-middle" style={{ background: d.colour }} />{d.acronym}</td>
                <td><Tyre c={r.compound} /> {label(r.compound)}</td>
                <td className="text-right font-mono">{r.age}</td>
                <td>
                  {r.slope == null ? <span className="muted">not enough clean laps yet</span> : (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded bg-neutral-900">
                        <div className={`h-2 rounded ${r.slope > 0.1 ? "bg-red-500" : r.slope > 0.05 ? "bg-amber-400" : "bg-emerald-500"}`}
                          style={{ width: `${(Math.max(0, r.slope) / max) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right font-mono">{r.slope >= 0 ? "+" : ""}{r.slope.toFixed(3)}</span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Every pit stop so far, newest first, with the fastest stationary time starred. */
export function PitStops({ f }: { f: LiveFeed }) {
  const { board, who } = useRaceBoard(f);
  if (!board) return waiting();
  if (!board.pits.length) return waiting("No pit stops yet.");
  const best = Math.min(...board.pits.map((p) => p.stop ?? Infinity));
  return (
    <div className="space-y-2">
      <Learn look="a slow stationary time (over ~3.5 s) usually means a sticky wheel nut, and can cost a position.">
        <b>Stop</b> is the time the car sat still while the wheels were changed. <b>Lane</b> is the whole drive through the pit lane, entry to exit,
        which is what the stop really costs (about 20 s at most tracks).
      </Learn>
      <table className="tbl text-xs">
        <thead><tr><th>Lap</th><th>Driver</th><th>Tyres</th><th className="text-right">Stop</th><th className="text-right">Lane</th></tr></thead>
        <tbody>
          {board.pits.map((p) => {
            const d = who.get(p.driver_number);
            return (
              <tr key={`${p.driver_number}-${p.date}`}>
                <td className="font-mono">{p.lap}</td>
                <td className="font-mono"><span className="mr-1 inline-block h-3 w-1 rounded align-middle" style={{ background: d?.colour ?? "#555" }} />{d?.acronym ?? p.driver_number}</td>
                <td><Tyre c={p.off} /> → <Tyre c={p.on} /> <span className="text-neutral-400">{label(p.on)}</span></td>
                <td className={`text-right font-mono ${p.stop === best ? "text-purple-300" : p.stop != null && p.stop > 3.5 ? "text-red-400" : ""}`}>
                  {p.stop == null ? "–" : `${p.stop.toFixed(1)} s`}{p.stop === best ? " ★" : ""}
                </td>
                <td className="text-right font-mono">{p.lane == null ? "–" : `${p.lane.toFixed(1)} s`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/**
 * Drag vs downforce: each car's best speed-trap reading against its best lap. OpenF1 doesn't report 2026 active-aero
 * modes, so this reads the aero trade-off from speeds instead.
 */
export function AeroChart({ f, height }: { f: LiveFeed; height: number }) {
  const { board, who } = useRaceBoard(f);
  const [team, setTeam] = useState(false);
  if (!board) return waiting();
  let pts = (board.aero ?? []).filter((a) => who.has(a.driver_number)).map((a) => {
    const d = who.get(a.driver_number)!;
    return { x: a.top, y: a.best, name: d.acronym, team: d.team, colour: d.colour, i1: a.i1, i2: a.i2 };
  });
  if (team) { // a car's aero package is the team's: keep each team's quicker car
    const best = new Map<string, (typeof pts)[number]>();
    for (const p of pts) { const b = best.get(p.team); if (!b || p.y < b.y) best.set(p.team, { ...p, x: Math.max(p.x, b?.x ?? 0) }); else b.x = Math.max(b.x, p.x); }
    pts = [...best.values()].map((p) => ({ ...p, name: p.team.split(" ")[0] }));
  }
  if (pts.length < 2) return waiting("Needs a few timed laps with speed-trap readings.");
  const mx = median(pts.map((p) => p.x)), my = median(pts.map((p) => p.y));
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <button className={`chip ${!team ? "chip-on" : ""}`} onClick={() => setTeam(false)}>Drivers</button>
        <button className={`chip ${team ? "chip-on" : ""}`} onClick={() => setTeam(true)}>Teams</button>
        <span className="muted ml-auto text-[11px]">→ faster on the straight · ↑ faster lap</span>
      </div>
      <Learn look="find the cars top-right (quick everywhere: efficient aero) and compare a car far right but low (low drag, little downforce) with one far left but high (lots of downforce).">
        More wing gives more downforce (faster corners) but more drag (slower straights). The <b>speed trap</b> shows the drag side, the <b>lap time</b>
        the overall result. In 2026 the cars switch to a low-drag straight mode on the straights; the live feed doesn&apos;t say when, so this uses the speeds.
        Top speed also depends on slipstream and battery deployment, so a single tow can flatter a car.
      </Learn>
      <ResponsiveContainer width="100%" height={Math.max(180, height)}>
        <ScatterChart margin={{ top: 10, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1d1d1f" />
          <XAxis type="number" dataKey="x" name="Top speed" domain={["dataMin - 3", "dataMax + 3"]} stroke="#555" fontSize={10}
            height={32} label={xTitle("Top speed at the speed trap (km/h) → less drag")} />
          <YAxis type="number" dataKey="y" name="Best lap" reversed width={70} domain={["dataMin - 0.3", "dataMax + 0.3"]} stroke="#555" fontSize={10} tickFormatter={fmtLap}
            label={yTitle("Best lap time (↑ faster)")} />
          <ReferenceLine x={mx} stroke="#333" strokeDasharray="4 4" />
          <ReferenceLine y={my} stroke="#333" strokeDasharray="4 4" />
          <Tooltip {...tooltip} cursor={false} content={({ payload }) => {
            const p = payload?.[0]?.payload as (typeof pts)[number] | undefined;
            return p ? (
              <div className="rounded border border-neutral-700 bg-[#0b0b0d] px-2 py-1 text-[11px]">
                <b style={{ color: p.colour }}>{p.name}</b> · {p.team}<br />Speed trap {p.x} km/h{p.i1 ? ` · I1 ${p.i1}` : ""}{p.i2 ? ` · I2 ${p.i2}` : ""}<br />Best lap {fmtLap(p.y)}
              </div>
            ) : null;
          }} />
          <Scatter data={pts} isAnimationActive={false} shape={(s: { cx?: number; cy?: number; payload?: { colour: string } }) => <circle cx={s.cx} cy={s.cy} r={5} fill={s.payload?.colour} stroke="#000" />}>
            <LabelList dataKey="name" position="right" fontSize={9} fill="#bbb" />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
