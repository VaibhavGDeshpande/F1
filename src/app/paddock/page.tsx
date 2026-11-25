import Link from "next/link";
import { PuTable } from "@/components/PuTable";
import { fiaUrl, getEvents, getLogbook } from "@/lib/fia";
import type { PenaltyKind } from "@/lib/fia-parse";

export const metadata = { title: "Paddock logbook" };
export const revalidate = 900;

const PENALTY_STYLE: Record<PenaltyKind, string> = {
  grid: "bg-red-500/20 text-red-300", dsq: "bg-red-700/30 text-red-200", "drive-through": "bg-orange-500/20 text-orange-300",
  "stop-go": "bg-orange-500/20 text-orange-300", time: "bg-orange-500/20 text-orange-300", reprimand: "bg-yellow-500/20 text-yellow-300",
  fine: "bg-yellow-500/20 text-yellow-300", warning: "bg-neutral-700 text-neutral-200", "no-action": "bg-neutral-800 text-neutral-400",
  other: "bg-neutral-800 text-neutral-300",
};

export default async function Paddock({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const eventId = event && /^\d{1,7}$/.test(event) ? event : undefined;
  const [events, log] = await Promise.all([getEvents(), getLogbook(eventId)]);
  const withCar = log.decisions.filter((d) => d.car != null);
  const general = log.decisions.filter((d) => d.car == null);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="h1">Paddock logbook {log.event && <span className="muted">— {log.event.name}</span>}</h1>
        <p className="muted text-sm">Penalties, power unit elements and parc fermé changes, parsed from official FIA documents. Always check the linked PDF.</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {events.map((e) => (
            <Link key={e.id} href={`/paddock?event=${e.id}`} className={`chip shrink-0 ${e.id === log.event?.id ? "chip-on" : ""}`}>{e.name.replace(" Grand Prix", " GP")}</Link>
          ))}
        </div>
      </header>

      <section className="card">
        <h2 className="h2">Stewards&apos; decisions</h2>
        {withCar.length === 0 ? <p className="muted text-sm">No decisions for this event yet.</p> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Doc</th><th>Car / driver</th><th>Session</th><th>Infringement</th><th>Decision</th><th>Pts</th></tr></thead>
              <tbody>
                {withCar.map((d) => (
                  <tr key={d.path} className="align-top">
                    <td><a href={fiaUrl(d.path)} target="_blank" rel="noreferrer" className="link">{d.no ?? "PDF"}</a></td>
                    <td className="whitespace-nowrap"><b>#{d.car}</b> {d.driver}<div className="muted text-xs">{d.competitor}</div></td>
                    <td className="muted whitespace-nowrap">{d.session}</td>
                    <td className="max-w-sm"><div>{d.title}</div><div className="muted whitespace-pre-line text-xs">{d.fact}</div></td>
                    <td className="max-w-xs">
                      <span className={`mr-1 inline-block rounded px-1.5 py-0.5 text-xs ${PENALTY_STYLE[d.penalty ?? "other"]}`}>{d.penalty === "grid" && d.gridDrop ? `-${d.gridDrop} grid` : d.penalty}</span>
                      <span className="text-sm">{d.decision}</span>
                    </td>
                    <td className="font-mono">{d.penaltyPoints ? <>+{d.penaltyPoints}{d.totalPoints && <span className="muted text-xs"> ({d.totalPoints} total)</span>}</> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {general.length > 0 && (
          <div className="mt-4">
            <div className="muted mb-1 text-xs">General decisions (deleted laps, procedures)</div>
            <ul className="space-y-1 text-sm">{general.map((d) => <li key={d.path}><a href={fiaUrl(d.path)} target="_blank" rel="noreferrer" className="link">{d.title}</a></li>)}</ul>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">Under investigation (summons)</h2>
          {log.summons.length === 0 ? <p className="muted text-sm">None.</p> : (
            <ul className="space-y-1 text-sm">{log.summons.map((d) => <li key={d.path}><a href={fiaUrl(d.path)} target="_blank" rel="noreferrer" className="link">{d.title}</a> <span className="muted text-xs">{d.published}</span></li>)}</ul>
          )}
        </section>
        <section className="card">
          <h2 className="h2">Parc fermé changes</h2>
          {log.parcFerme.length === 0 ? <p className="muted text-sm">None reported.</p> : (
            <table className="tbl"><tbody>
              {log.parcFerme.map((c, i) => <tr key={i}><td className="font-mono">#{c.car}</td><td className="muted">{c.team}</td><td>{c.change}</td></tr>)}
            </tbody></table>
          )}
          {log.upgrades.map((d) => (
            <p key={d.path} className="mt-3 text-sm">Car upgrades declared this weekend: <a href={fiaUrl(d.path)} target="_blank" rel="noreferrer" className="link">{d.title} (PDF)</a></p>
          ))}
        </section>
      </div>

      <section className="card">
        <h2 className="h2">Power unit elements used this season</h2>
        {log.pu ? (
          <>
            <PuTable rows={log.pu.rows} />
            <p className="muted mt-2 text-xs">Amber = at the season limit (next new element = grid penalty) · red = over the limit. Source: <a className="link" href={fiaUrl(log.pu.doc.path)} target="_blank" rel="noreferrer">{log.pu.doc.title}</a></p>
          </>
        ) : <p className="muted text-sm">No PU usage report for this event.</p>}
      </section>

      <section className="card">
        <h2 className="h2">All documents ({log.docs.length})</h2>
        <ul className="grid gap-1 text-sm md:grid-cols-2">
          {log.docs.map((d) => <li key={d.path}><a href={fiaUrl(d.path)} target="_blank" rel="noreferrer" className="hover:underline">{d.no != null && <span className="muted">{d.no} · </span>}{d.title}</a></li>)}
        </ul>
      </section>
    </div>
  );
}
