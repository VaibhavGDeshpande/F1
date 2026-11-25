"use client";
import { BatteryWarning } from "lucide-react";
import type { Clip } from "@/lib/corner-analysis";

type Row = { code: string; colour: string; clips: (Clip & { after: string | null })[] };

/** Where each car ran out of electrical deployment on the straights (speed fading at full throttle). */
export function ClippingPanel({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const metres = r.clips.reduce((s, c) => s + c.endD - c.startD, 0), lost = r.clips.reduce((s, c) => s + c.from - c.to, 0);
          return (
            <div key={r.code} className="rounded-xl border border-neutral-800 bg-black/20 p-3" style={{ borderLeft: `3px solid ${r.colour}` }}>
              <div className="flex items-baseline gap-2">
                <b style={{ color: r.colour }}>{r.code}</b>
                <span className="text-xs text-neutral-400">
                  {r.clips.length ? <>{r.clips.length} clipping zone{r.clips.length > 1 ? "s" : ""} · {Math.round(metres)} m flat out while slowing · −{lost} km/h in total</> : "no clipping on this lap"}
                </span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs">
                {r.clips.map((c, i) => (
                  <li key={i} className="font-mono">
                    <BatteryWarning size={11} className="mr-1 inline text-amber-400" />
                    {c.after ? `after T${c.after}` : "start/finish straight"}: {c.from} → {c.to} km/h <span className="text-amber-300">(−{c.from - c.to})</span>
                    <span className="text-neutral-500"> over {Math.round(c.endD - c.startD)} m</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="muted text-[11px]">
        Under the 2026 rules the electric motor provides about half the power, but the battery can&apos;t deploy flat out for a whole lap. When it runs
        out on a straight the car &quot;clips&quot;: still at full throttle, yet speed stops rising and falls. Flagged when the car loses 3+ km/h over 3+ samples
        at full throttle above 200 km/h. Shaded on the speed trace above.
      </p>
    </div>
  );
}
