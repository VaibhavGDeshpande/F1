import Link from "next/link";
import { notFound } from "next/navigation";
import { DegScatter, LapLines } from "@/components/Charts";
import { TeamTag } from "@/components/Cards";
import { Img } from "@/components/Img";
import { TyreLegend } from "@/components/Legend";
import { StintChart } from "@/components/StintChart";
import { compoundSummary, fmtLap, neutralisedLaps, stintDegradation } from "@/lib/analysis";
import { compoundColour, SAFE_SESSION, teamColour } from "@/lib/openf1";
import { isRace, positionsByLap, sessionData } from "@/lib/session";
import { Learn } from "@/components/Learn";

export const revalidate = 60;

export default async function SessionPage({ params }: { params: Promise<{ sessionKey: string }> }) {
  const { sessionKey } = await params;
  if (!SAFE_SESSION.test(sessionKey)) notFound();
  const data = await sessionData(sessionKey);
  if (!data) notFound();
  const { session, drivers, laps, stints, rc, pits, positions } = data;
  const race = isRace(session);
  const names = Object.fromEntries(drivers.map((d) => [d.driver_number, d.name_acronym]));

  // classification: race = final running order, others = fastest lap
  const best = new Map<number, number>();
  for (const l of laps) if (l.lap_duration && !(best.get(l.driver_number)! <= l.lap_duration)) best.set(l.driver_number, l.lap_duration);
  const finalPos = new Map<number, number>();
  for (const p of [...positions].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) finalPos.set(p.driver_number, p.position);
  const order = drivers
    .map((d) => d.driver_number)
    .sort((a, b) => (race ? (finalPos.get(a) ?? 99) - (finalPos.get(b) ?? 99) : (best.get(a) ?? 1e9) - (best.get(b) ?? 1e9)));
  const fastestLap = Math.min(...best.values());
  const lapCount = (n: number) => laps.filter((l) => l.driver_number === n).length;

  const degs = stintDegradation(laps, stints, neutralisedLaps(rc));
  const summary = compoundSummary(degs);
  const top = order.slice(0, 6);
  const series = top.map((n) => ({ key: String(n), label: names[n], colour: teamColour(drivers.find((d) => d.driver_number === n)) }));
  const lapRows = (() => {
    const rows = new Map<number, Record<string, number>>();
    for (const l of laps) {
      if (!top.includes(l.driver_number) || !l.lap_duration || l.lap_duration > fastestLap * 1.15) continue;
      const r = rows.get(l.lap_number) ?? { lap: l.lap_number };
      r[String(l.driver_number)] = l.lap_duration;
      rows.set(l.lap_number, r);
    }
    return [...rows.values()].sort((a, b) => a.lap - b.lap);
  })();
  const stops = pits.filter((p) => (p.stop_duration ?? p.pit_duration) != null).sort((a, b) => (a.stop_duration ?? a.pit_duration!) - (b.stop_duration ?? b.pit_duration!));

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/weekend/${session.meeting_key}`} className="link text-sm">← {session.location} weekend</Link>
        <h1 className="h1">{session.location} {session.year} — {session.session_name}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <h2 className="h2">Classification</h2>
          <table className="tbl">
            <thead><tr><th>#</th><th>Driver</th><th>Best</th><th>{race ? "Laps" : "Gap"}</th></tr></thead>
            <tbody>
              {order.map((n, i) => {
                const d = drivers.find((x) => x.driver_number === n)!;
                const b = best.get(n);
                return (
                  <tr key={n}>
                    <td className="muted">{race ? finalPos.get(n) ?? "—" : i + 1}</td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-4 w-1 rounded" style={{ background: teamColour(d) }} />
                        <Img src={d.headshot_url} alt="" className="h-6 w-6 rounded-full bg-neutral-800 object-cover" />
                        <b>{d.name_acronym}</b><TeamTag name={d.team_name} className="text-xs text-neutral-400" />
                      </span>
                    </td>
                    <td className={`font-mono ${b === fastestLap ? "text-purple-400" : ""}`}>{fmtLap(b)}</td>
                    <td className="font-mono muted">{race ? lapCount(n) : b ? (b === fastestLap ? "—" : `+${(b - fastestLap).toFixed(3)}`) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card lg:col-span-2">
          <h2 className="h2">Tyre strategy</h2>
          <p className="muted mb-2 text-xs">Each bar is one set of tyres; a new bar starts after a pit stop. Hover for laps and tyre age.</p>
          <Learn className="mb-2" look="compare the drivers who finished ahead with those behind. Did they stop more or less often, or later?">A team chooses when to stop and on which tyre. Drivers gaining places often stopped at a different time from the cars around them.</Learn>
          <StintChart stints={stints} order={order} names={names} />
          <div className="mt-3"><TyreLegend /></div>
        </section>
      </div>

      {race && positions.length > 0 && (
        <section className="card">
          <h2 className="h2">Positions by lap</h2>
          <Learn className="mb-2">A line moving up means the driver gained a place. Clusters of position changes at the same lap are usually pit stops or a safety car.</Learn>
          <LapLines data={positionsByLap(laps, positions)} reversed height={420}
            series={order.map((n) => ({ key: String(n), label: names[n], colour: teamColour(drivers.find((d) => d.driver_number === n)) }))} />
        </section>
      )}

      <section className="card">
        <h2 className="h2">Lap times — top 6</h2>
        <LapLines data={lapRows} series={series} lapTimes />
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="h2">Tyre degradation</h2>
          <p className="muted text-xs">
            Seconds lost per lap of tyre age, from clean laps only (no out/in-laps, SC/VSC, or laps over 107% of the stint&apos;s best), with an
            estimated fuel-burn correction. Needs 5+ clean laps per stint, so practice numbers come from long runs. Estimates — fuel loads aren&apos;t public.
          </p>
        </div>
        {summary.length === 0 ? <p className="muted text-sm">No long runs in this session.</p> : (
          <>
            <div className="flex flex-wrap gap-3">
              {summary.map((s) => (
                <div key={s.compound} className="rounded-lg border border-neutral-800 px-4 py-2">
                  <div className="text-xs font-bold" style={{ color: compoundColour(s.compound) }}>{s.compound}</div>
                  <div className="font-mono text-lg">{s.deg >= 0 ? "+" : ""}{s.deg.toFixed(3)} s/lap</div>
                  <div className="muted text-xs">{s.stints} stints · {s.laps} laps · pace {fmtLap(s.pace)}</div>
                </div>
              ))}
            </div>
            <DegScatter stints={degs} names={names} />
            <details>
              <summary className="cursor-pointer text-sm">Per-stint table</summary>
              <table className="tbl mt-2">
                <thead><tr><th>Driver</th><th>Stint</th><th>Compound</th><th>Clean laps</th><th>Deg (s/lap)</th><th>Avg pace</th></tr></thead>
                <tbody>
                  {[...degs].sort((a, b) => a.slope - b.slope).map((d) => (
                    <tr key={`${d.driver_number}-${d.stint_number}`}>
                      <td>{names[d.driver_number]}</td><td>{d.stint_number}</td>
                      <td style={{ color: compoundColour(d.compound) }}>{d.compound}</td><td>{d.laps}</td>
                      <td className="font-mono">{d.slope.toFixed(3)}</td><td className="font-mono">{fmtLap(d.pace)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>

      <Link href={`/pit-wall?sk=${session.session_key}&drivers=${order.slice(0, 2).map((n) => names[n]).join(",")}&fastest=1`}
        className="card flex items-center justify-between hover:border-red-600">
        <span><b>Compare laps on the Pit Wall</b> <span className="muted text-sm">— speed, throttle, brake, gear and gap, replayed on the track map</span></span>
        <span className="text-red-500">→</span>
      </Link>

      {stops.length > 0 && (
        <section className="card">
          <h2 className="h2">Pit stops (fastest first)</h2>
          <table className="tbl">
            <thead><tr><th>Driver</th><th>Lap</th><th>Stationary</th><th>Pit lane</th></tr></thead>
            <tbody>
              {stops.slice(0, 20).map((p) => (
                <tr key={`${p.driver_number}-${p.lap_number}`}>
                  <td>{names[p.driver_number]}</td><td>{p.lap_number}</td>
                  <td className="font-mono">{p.stop_duration != null ? `${p.stop_duration.toFixed(1)}s` : "—"}</td>
                  <td className="font-mono muted">{p.pit_duration != null ? `${p.pit_duration.toFixed(1)}s` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
