import { compoundColour, type Stint } from "@/lib/openf1";

/** Horizontal tyre-strategy bars, one row per driver. */
export function StintChart({ stints, order, names }: { stints: Stint[]; order: number[]; names: Record<number, string> }) {
  const total = Math.max(1, ...stints.map((s) => s.lap_end));
  return (
    <div className="space-y-1 text-xs">
      {order.map((n) => (
        <div key={n} className="flex items-center gap-2">
          <span className="w-10 shrink-0 font-mono">{names[n] ?? n}</span>
          <div className="relative h-4 flex-1 rounded bg-neutral-900">
            {stints.filter((s) => s.driver_number === n).map((s) => (
              <div key={s.stint_number} title={`${s.compound ?? "?"} · laps ${s.lap_start}–${s.lap_end}${s.tyre_age_at_start ? ` · ${s.tyre_age_at_start} laps old` : " · new"}`}
                className="absolute top-0 h-4 rounded-sm border border-black/60 text-[10px] leading-4 text-black"
                style={{ left: `${((s.lap_start - 1) / total) * 100}%`, width: `${((s.lap_end - s.lap_start + 1) / total) * 100}%`, background: compoundColour(s.compound) }}>
                <span className="px-1">{s.compound?.[0]}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* lap scale under the bars */}
      <div className="flex items-start gap-2 pt-0.5 text-[10px] text-neutral-500">
        <span className="w-10 shrink-0">Lap →</span>
        <div className="relative h-3 flex-1">
          {[...new Set([1, ...[0.25, 0.5, 0.75].map((f) => Math.round(total * f)), total])].map((lap) => (
            <span key={lap} className="absolute -translate-x-1/2 font-mono" style={{ left: `${((lap - 0.5) / total) * 100}%` }}>{lap}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
