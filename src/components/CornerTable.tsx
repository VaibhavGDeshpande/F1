"use client";
import { CornerDownRight } from "lucide-react";
import type { CornerRow } from "@/lib/corner-analysis";

type Who = { code: string; colour: string };
const sign = (x: number, dp = 2) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(dp)}`;

/** Corner-by-corner comparison: braking point, minimum speed, power-on point and time gained/lost per corner. */
export function CornerTable({ rows, who }: { rows: CornerRow[]; who: Who[] }) {
  if (!rows.length) return <p className="muted text-sm">Corner positions or telemetry not available for this lap yet.</p>;
  const others = who.slice(1).map((w, k) => {
    const i = k + 1, d = rows.map((r) => ({ r, delta: r.drivers[i].delta }));
    const gain = d.reduce((a, x) => (x.delta < a.delta ? x : a)), loss = d.reduce((a, x) => (x.delta > a.delta ? x : a));
    return { w, total: d.reduce((s, x) => s + x.delta, 0), gain, loss };
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {others.map(({ w, total, gain, loss }) => (
          <div key={w.code} className="rounded-xl border border-neutral-800 bg-black/20 px-3 py-2 text-xs" style={{ borderLeft: `3px solid ${w.colour}` }}>
            <b style={{ color: w.colour }}>{w.code}</b> vs <b style={{ color: who[0].colour }}>{who[0].code}</b>:{" "}
            <span className={total <= 0 ? "text-emerald-400" : "text-red-400"}>{sign(total)} s over the lap</span>
            {gain.delta < 0 && <> · biggest gain <b>T{gain.r.label}</b> <span className="text-emerald-400">{sign(gain.delta)}</span></>}
            {loss.delta > 0 && <> · biggest loss <b>T{loss.r.label}</b> <span className="text-red-400">{sign(loss.delta)}</span></>}
          </div>
        ))}
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <table className="tbl whitespace-nowrap text-xs">
          <thead className="sticky top-0 bg-[#111113]">
            <tr>
              <th rowSpan={2}>Turn</th>
              {who.map((w, i) => <th key={w.code} colSpan={4} className="border-l border-neutral-800 text-center" style={{ color: w.colour }}>{w.code}{i === 0 && " (ref)"}</th>)}
            </tr>
            <tr>
              {who.map((w, i) => [
                <th key={`${w.code}m`} className="border-l border-neutral-800" title="Minimum speed in the corner">Min</th>,
                <th key={`${w.code}b`} title="Metres before the corner where braking starts">Brake</th>,
                <th key={`${w.code}p`} title="Metres after the corner where full throttle comes back (− = before it)">Power</th>,
                <th key={`${w.code}t`} title={i ? "Time gained (−) or lost (+) in this corner vs the reference" : "Time spent in this corner's section"}>{i ? "Δ" : "Time"}</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bestMin = Math.max(...r.drivers.map((d) => d.minSpeed));
              const brakes = r.drivers.map((d) => d.brakeBefore).filter((b): b is number => b != null);
              const latest = brakes.length > 1 ? Math.min(...brakes) : null;
              return (
                <tr key={r.label}>
                  <td title={r.name}><b>T{r.label}</b>{r.name && <span className="ml-1 text-neutral-500">{r.name}</span>}</td>
                  {r.drivers.map((d, i) => [
                    <td key={`${i}m`} className={`border-l border-neutral-800 font-mono ${d.minSpeed === bestMin && r.drivers.length > 1 ? "font-bold text-white" : "text-neutral-300"}`}>{d.minSpeed}</td>,
                    <td key={`${i}b`} className={`font-mono ${d.brakeBefore != null && d.brakeBefore === latest ? "font-bold text-white" : "text-neutral-400"}`}>
                      {d.brakeBefore == null ? <span className="text-neutral-600">flat</span> : `${Math.round(d.brakeBefore)} m`}
                    </td>,
                    <td key={`${i}p`} className="font-mono text-neutral-400">{d.throttleAfter == null ? "–" : `${d.throttleAfter >= 0 ? "+" : "−"}${Math.abs(Math.round(d.throttleAfter))} m`}</td>,
                    <td key={`${i}t`} className={`font-mono ${!i ? "text-neutral-400" : d.delta < -0.005 ? "text-emerald-400" : d.delta > 0.005 ? "text-red-400" : "text-neutral-500"}`}>
                      {i ? sign(d.delta, 3) : `${d.time.toFixed(2)} s`}
                    </td>,
                  ])}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted flex items-start gap-1 text-[11px]">
        <CornerDownRight size={12} className="mt-0.5 shrink-0" />
        Bold = best in that corner (highest minimum speed, latest braking). Each corner covers the track from halfway after the previous corner to halfway
        before the next, so the Δ column adds up to the whole lap gap. Telemetry is sampled ~4 times a second, so braking and power points are ±15–25 m.
      </p>
    </div>
  );
}
