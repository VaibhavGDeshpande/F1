"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { fmtLap, type StintDeg } from "@/lib/analysis";
import { compoundColour } from "@/lib/openf1";

const tooltip = { contentStyle: { background: "#111", border: "1px solid #333", fontSize: 12 }, labelStyle: { color: "#aaa" } };
const axis = { stroke: "#666", fontSize: 11 };
// axis titles shared by every chart; give the XAxis height ≈ 32 and the YAxis ~14 px extra width to make room
export const xTitle = (value: string) => ({ value, position: "insideBottom" as const, offset: 0, fill: "#8a8a8a", fontSize: 10 });
export const yTitle = (value: string) => ({ value, angle: -90, position: "insideLeft" as const, offset: 4, fill: "#8a8a8a", fontSize: 10, style: { textAnchor: "middle" as const } });

export type Series = { key: string; label: string; colour: string };

/** Multi-driver line chart keyed by lap (positions, lap times). */
export function LapLines({ data, series, reversed, lapTimes, height = 320 }: {
  data: Record<string, number>[]; series: Series[]; reversed?: boolean; lapTimes?: boolean; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#222" />
        <XAxis dataKey="lap" {...axis} height={32} label={xTitle("Lap")} />
        <YAxis {...axis} reversed={reversed} domain={lapTimes ? ["dataMin - 0.5", "dataMax + 0.5"] : [1, "dataMax"]} allowDecimals={!!lapTimes}
          tickFormatter={(v: number) => (lapTimes ? fmtLap(v) : String(v))} width={lapTimes ? 78 : 46} interval={reversed ? 0 : undefined}
          label={yTitle(lapTimes ? "Lap time" : "Position")} />
        <Tooltip {...tooltip} formatter={(v) => (lapTimes ? fmtLap(Number(v)) : String(v))} labelFormatter={(l) => `Lap ${l}`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.colour} dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Fuel-corrected lap time vs tyre age, one colour per compound. */
export function DegScatter({ stints, names }: { stints: StintDeg[]; names: Record<number, string> }) {
  const compounds = [...new Set(stints.map((s) => s.compound))];
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#222" />
        <XAxis type="number" dataKey="age" name="Tyre age" {...axis} height={32} label={xTitle("Tyre age (laps)")} />
        <YAxis type="number" dataKey="time" name="Lap" {...axis} domain={["dataMin - 0.3", "dataMax + 0.3"]} tickFormatter={fmtLap} width={78}
          label={yTitle("Lap time (fuel-corrected)")} />
        <Tooltip {...tooltip} formatter={(v, n) => (n === "Lap" ? fmtLap(Number(v)) : String(v))} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {compounds.map((c) => (
          <Scatter key={c} name={c} fill={compoundColour(c)} isAnimationActive={false}
            data={stints.filter((s) => s.compound === c).flatMap((s) => s.points.map((p) => ({ ...p, driver: names[s.driver_number] })))} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Generic numeric-x telemetry chart; each line can carry its own data array. */
export function TelemetryChart({ lines, xLabel, xTitle: xt, yTitle: yt, yDomain, height = 220, unit = "" }: {
  lines: { name: string; colour: string; data: { x: number; y: number }[]; dashed?: boolean }[];
  /** xLabel: unit used in the tooltip ("lap", "s"); xTitle / yTitle: what each axis means */
  xLabel: string; xTitle: string; yTitle: string; yDomain?: [number | string, number | string]; height?: number; unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#222" />
        <XAxis type="number" dataKey="x" domain={["dataMin", "dataMax"]} {...axis} tickFormatter={(v: number) => v.toFixed(0)}
          height={32} label={xTitle(xt)} allowDuplicatedCategory={false} />
        <YAxis {...axis} domain={yDomain ?? ["auto", "auto"]} width={58} label={yTitle(yt)} />
        <Tooltip {...tooltip} formatter={(v) => `${Number(v).toFixed(unit === "s" ? 3 : 0)}${unit}`} labelFormatter={(l) => `${Number(l).toFixed(0)} ${xLabel}`} />
        {lines.map((l) => (
          <Line key={l.name} data={l.data} dataKey="y" name={l.name} stroke={l.colour} dot={false} strokeWidth={1.5}
            strokeDasharray={l.dashed ? "4 3" : undefined} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
