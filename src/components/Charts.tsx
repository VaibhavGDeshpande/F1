"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { fmtLap, type StintDeg } from "@/lib/analysis";
import { compoundColour } from "@/lib/openf1";

const tooltip = { contentStyle: { background: "#111", border: "1px solid #333", fontSize: 12 }, labelStyle: { color: "#aaa" } };
const axis = { stroke: "#666", fontSize: 11 };

export type Series = { key: string; label: string; colour: string };

/** Multi-driver line chart keyed by lap (positions, lap times). */
export function LapLines({ data, series, reversed, lapTimes, height = 320 }: {
  data: Record<string, number>[]; series: Series[]; reversed?: boolean; lapTimes?: boolean; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#222" />
        <XAxis dataKey="lap" {...axis} />
        <YAxis {...axis} reversed={reversed} domain={lapTimes ? ["dataMin - 0.5", "dataMax + 0.5"] : [1, "dataMax"]} allowDecimals={!!lapTimes}
          tickFormatter={(v: number) => (lapTimes ? fmtLap(v) : String(v))} width={lapTimes ? 64 : 32} interval={reversed ? 0 : undefined} />
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
        <XAxis type="number" dataKey="age" name="Tyre age" {...axis} label={{ value: "tyre age (laps)", position: "insideBottom", fill: "#666", fontSize: 11 }} />
        <YAxis type="number" dataKey="time" name="Lap" {...axis} domain={["dataMin - 0.3", "dataMax + 0.3"]} tickFormatter={fmtLap} width={64} />
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
export function TelemetryChart({ lines, xLabel, yDomain, height = 220, unit = "" }: {
  lines: { name: string; colour: string; data: { x: number; y: number }[]; dashed?: boolean }[];
  xLabel: string; yDomain?: [number | string, number | string]; height?: number; unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#222" />
        <XAxis type="number" dataKey="x" domain={["dataMin", "dataMax"]} {...axis} tickFormatter={(v: number) => v.toFixed(0)}
          label={{ value: xLabel, position: "insideBottomRight", fill: "#666", fontSize: 11 }} allowDuplicatedCategory={false} />
        <YAxis {...axis} domain={yDomain ?? ["auto", "auto"]} width={44} />
        <Tooltip {...tooltip} formatter={(v) => `${Number(v).toFixed(unit === "s" ? 3 : 0)}${unit}`} labelFormatter={(l) => `${Number(l).toFixed(0)} ${xLabel}`} />
        {lines.map((l) => (
          <Line key={l.name} data={l.data} dataKey="y" name={l.name} stroke={l.colour} dot={false} strokeWidth={1.5}
            strokeDasharray={l.dashed ? "4 3" : undefined} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
