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
    </div>
  );
}
