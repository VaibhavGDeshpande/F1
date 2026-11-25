"use client";
import { Swords } from "lucide-react";
import type { LiveState, TowerRow } from "@/lib/live";
import { compoundColour } from "@/lib/openf1";

/** "If they pit now…" table, pit windows and undercut/overcut threats (races and sprints only). */
export function StrategyPanel({ s, tower }: { s: NonNullable<LiveState["strategy"]>; tower: TowerRow[] }) {
  const colour = (code: string) => tower.find((r) => r.acronym === code)?.colour ?? "#888";
  const threats = [...s.threats].sort((a, b) => b.gain - b.interval - (a.gain - a.interval)).slice(0, 6);
  const tag = (code: string) => <b style={{ color: colour(code) }}>{code}</b>;

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="h2 mb-0"><Swords size={14} />Strategy</h2>
        <span className="muted text-xs">
          Pit stop costs ~{s.pitLoss.toFixed(1)} s{s.underSC && " (cheaper under the safety car)"}
          {s.lapsLeft != null && <> · ≈{s.lapsLeft} of {s.totalLaps} laps left</>}
        </span>
      </div>

      {threats.length > 0 && (
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {threats.map((t) => (
            <li key={`${t.kind}${t.attacker}`} className={`rounded-lg border px-2 py-1.5 ${t.kind === "undercut" ? "border-red-700/60 bg-red-950/30" : "border-sky-700/60 bg-sky-950/30"}`}>
              <span className={`mr-1.5 text-[10px] font-bold uppercase ${t.kind === "undercut" ? "text-red-300" : "text-sky-300"}`}>{t.kind}</span>
              {t.kind === "undercut"
                ? <>{tag(t.attacker)} can undercut {tag(t.defender)}: {t.interval.toFixed(1)} s behind, a stop first is worth ~{t.gain.toFixed(1)} s</>
                : <>{tag(t.attacker)} could overcut {tag(t.defender)}: tyres barely worn, so staying out longer can work</>}
            </li>
          ))}
        </ul>
      )}

      <div className="max-h-96 overflow-auto">
        <table className="tbl whitespace-nowrap text-xs">
          <thead className="sticky top-0 bg-[#111113]">
            <tr><th>P</th><th>Driver</th><th>Tyre</th><th title="Seconds per lap slower than on new tyres">Wear cost</th><th>If they pit now…</th><th>Pit window</th></tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.n}>
                <td className="text-neutral-400">{r.position}</td>
                <td><span className="mr-1.5 inline-block h-3 w-1 rounded align-middle" style={{ background: colour(r.code) }} /><b>{r.code}</b></td>
                <td>{r.compound && <><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: compoundColour(r.compound) }} />{r.compound[0]} · {r.age} laps</>}</td>
                <td className="font-mono">{r.tyreLoss != null ? `+${r.tyreLoss.toFixed(2)} s/lap` : "–"}</td>
                <td>
                  {r.rejoin ? (
                    <span>
                      rejoins <b>P{r.rejoin.position}</b>
                      {r.rejoin.ahead && <span className="text-neutral-400"> · {r.rejoin.ahead.gap.toFixed(1)} s behind {r.rejoin.ahead.code}</span>}
                      {r.rejoin.behind && <span className={r.rejoin.behind.gap < 1.5 ? "text-amber-300" : "text-neutral-500"}> · {r.rejoin.behind.gap.toFixed(1)} s ahead of {r.rejoin.behind.code}</span>}
                    </span>
                  ) : <span className="text-neutral-500">lapped / no gap</span>}
                </td>
                <td>
                  {r.windowOpen ? <span className="rounded bg-emerald-600/25 px-1.5 py-0.5 text-emerald-300">open</span>
                    : r.payback != null ? <span className="text-neutral-500">pays back in {Math.round(r.payback)} laps</span> : <span className="text-neutral-600">–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted text-[11px]">
        Estimates from timing data. <b>Wear cost</b> = tyre age × typical wear for that compound
        ({Object.entries(s.deg).filter(([c]) => s.rows.some((r) => r.compound === c)).map(([c, d]) => `${c.toLowerCase()} ${d.value.toFixed(2)} s/lap${d.measured ? "" : " typical"}`).join(", ") || "none yet"}).
        <b> Window open</b> = a stop now wins its time back before the flag. Undercut = the car behind pits first and gains the leader&apos;s tyre deficit for ~2 laps.
      </p>
    </section>
  );
}
