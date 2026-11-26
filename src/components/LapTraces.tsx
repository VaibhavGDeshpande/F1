"use client";
// Distance-based telemetry traces shared by Pit Wall and the Live "Lap compare" widget.
import { memo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TelPoint } from "@/lib/analysis";
import { xTitle } from "./Charts";

export const tooltip = { contentStyle: { background: "#0b0b0d", border: "1px solid #333", fontSize: 11 }, labelStyle: { color: "#999" } };
export type TraceLine = { code: string; colour: string; points: TelPoint[] };
const CHANNELS = [
  { key: "speed", label: "Speed (km/h)", h: 140 },
  { key: "throttle", label: "Throttle (%)", h: 80, domain: [0, 100] },
  { key: "brake", label: "Brake", h: 55, domain: [0, 100], step: true },
  { key: "gear", label: "Gear", h: 80, domain: [1, 8], step: true },
  { key: "rpm", label: "RPM", h: 80 },
] as const;

/** Stacked distance-based traces. Memoised so the moving play-head cursor doesn't re-render the charts. */
export const Traces = memo(function Traces({ shown, deltas, refCode, maxD, clipAreas = [] }: {
  shown: TraceLine[]; deltas: { code: string; colour: string; data: { d: number; delta: number }[] }[]; refCode: string; maxD: number;
  clipAreas?: { x1: number; x2: number; colour: string }[]; // energy clipping zones, shaded on the speed trace
}) {
  const chart = (label: string, h: number, lines: { name: string; colour: string; data: { x: number; y: number }[] }[], opts: { domain?: readonly [number, number]; step?: boolean; last?: boolean; areas?: typeof clipAreas } = {}) => (
    <div key={label}>
      <div className="text-[10px] font-semibold text-neutral-400">{label}</div>
      <ResponsiveContainer width="100%" height={h + (opts.last ? 32 : 0)}>
        <LineChart syncId="pitwall" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1d1d1f" vertical={false} />
          <XAxis type="number" dataKey="x" domain={[0, maxD]} allowDataOverflow hide={!opts.last} stroke="#555" fontSize={10} tickFormatter={(v: number) => `${Math.round(v)}m`}
            height={32} label={xTitle("Distance round the lap (m)")} />
          <YAxis width={40} stroke="#555" fontSize={10} domain={opts.domain ? [...opts.domain] : ["auto", "auto"]} tickCount={3} />
          <Tooltip {...tooltip} labelFormatter={(l) => `${Math.round(Number(l))} m`} formatter={(v) => Number(v).toFixed(label.startsWith("Δ") ? 3 : 0)} />
          {opts.areas?.map((a, k) => <ReferenceArea key={k} x1={a.x1} x2={a.x2} fill={a.colour} fillOpacity={0.18} stroke={a.colour} strokeOpacity={0.4} ifOverflow="hidden" />)}
          {lines.map((l) => (
            <Line key={l.name} data={l.data} dataKey="y" name={l.name} stroke={l.colour} dot={false} strokeWidth={1.4} isAnimationActive={false} type={opts.step ? "stepAfter" : "linear"} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
  return (
    <div className="space-y-1">
      {deltas.length > 0 && chart(`Δ vs ${refCode} (s, + = slower)`, 90, deltas.map((d) => ({ name: d.code, colour: d.colour, data: d.data.map((p) => ({ x: p.d, y: p.delta })) })))}
      {CHANNELS.map((c, i) =>
        chart(c.label, c.h, shown.map((s) => ({ name: s.code, colour: s.colour, data: s.points.map((p) => ({ x: p.d, y: p[c.key] })) })),
          { domain: "domain" in c ? c.domain : undefined, step: "step" in c, last: i === CHANNELS.length - 1, areas: c.key === "speed" ? clipAreas : undefined }),
      )}
    </div>
  );
});
