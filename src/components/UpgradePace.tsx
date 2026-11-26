"use client";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { xTitle, yTitle } from "./Charts";
import { tooltip } from "./LapTraces";

export type PacePoint = { race: string; gap: number | null; perf: number; parts: number };
export type Verdict = { race: string; perf: number; before: number; after: number };

const axis = { stroke: "#666", fontSize: 11 };

/** Qualifying gap to the fastest lap, round by round, with the weekends that brought performance parts marked. */
export function UpgradePace({ points, verdicts, colour }: { points: PacePoint[]; verdicts: Verdict[]; colour: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points} margin={{ top: 16, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="#222" />
          <XAxis dataKey="race" {...axis} angle={-40} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} label={{ ...xTitle("Race weekend"), offset: -18 }} />
          <YAxis {...axis} width={52} tickFormatter={(v: number) => `${v}%`} label={yTitle("Slower than the fastest lap (%)")} />
          <Tooltip {...tooltip} formatter={(v) => [`${Number(v).toFixed(2)}% off the fastest lap`, "Qualifying"]}
            labelFormatter={(l) => {
              const p = points.find((x) => x.race === l);
              return `${l}${p?.parts ? ` · ${p.parts} new part${p.parts > 1 ? "s" : ""} (${p.perf} performance)` : ""}`;
            }} />
          {points.filter((p) => p.perf).map((p) => (
            <ReferenceLine key={p.race} x={p.race} stroke={colour} strokeOpacity={0.5} strokeDasharray="3 3"
              label={{ value: `+${p.perf}`, position: "top", fill: colour, fontSize: 10 }} />
          ))}
          <Line dataKey="gap" stroke={colour} strokeWidth={2} connectNulls isAnimationActive={false}
            dot={(d: { cx?: number; cy?: number; index?: number }) => {
              const up = points[d.index ?? 0]?.perf;
              return <circle key={d.index} cx={d.cx} cy={d.cy} r={up ? 5 : 2.5} fill={up ? colour : "#0b0b0d"} stroke={colour} strokeWidth={1.5} />;
            }} />
        </LineChart>
      </ResponsiveContainer>
      <div>
        <h3 className="mb-1 text-xs font-semibold text-neutral-300">Upgrade weekends: 3 races before vs that race and the 2 after</h3>
        {!verdicts.length && <p className="muted text-xs">No performance upgrades with races either side yet.</p>}
        <table className="w-full text-xs">
          <thead className="text-left text-neutral-500"><tr><th className="py-1 font-normal">Weekend</th><th className="font-normal">Parts</th><th className="text-right font-normal">Before → after</th></tr></thead>
          <tbody>
            {verdicts.map((v) => {
              const d = v.after - v.before, better = d < -0.05, worse = d > 0.05;
              return (
                <tr key={v.race} className="border-t border-neutral-800">
                  <td className="py-1 text-neutral-300">{v.race}</td>
                  <td className="font-mono">{v.perf}</td>
                  <td className="text-right font-mono">
                    {v.before.toFixed(2)}% → {v.after.toFixed(2)}%{" "}
                    <span className={better ? "text-emerald-400" : worse ? "text-red-400" : "text-neutral-500"}>
                      {better ? "▲ closer" : worse ? "▼ further" : "≈ same"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
