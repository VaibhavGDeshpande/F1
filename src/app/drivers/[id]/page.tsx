import Link from "next/link";
import { notFound } from "next/navigation";
import { PosChip, Stat, TeamTag } from "@/components/Cards";
import { Img } from "@/components/Img";
import { PuTable } from "@/components/PuTable";
import { latestPuUsage } from "@/lib/fia";
import { driverInfo, driverResults, SAFE_ID } from "@/lib/jolpica";
import { teamCar } from "@/lib/media";
import { getNews } from "@/lib/news";
import { roster } from "@/lib/roster";

export default async function DriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SAFE_ID.test(id)) notFound();
  const info = await driverInfo(id);
  if (!info) notFound();
  const [races, drivers, pu, news] = await Promise.all([
    driverResults(id),
    roster().catch(() => []),
    latestPuUsage().catch(() => null),
    getNews({ q: info.familyName }),
  ]);
  const d = drivers.find((x) => x.id === id);
  const colour = d?.colour ?? "#888888";
  const team = d?.team ?? races.at(-1)?.Results?.[0]?.Constructor.name ?? "";
  const results = races.map((r) => r.Results?.[0]).filter((r) => r != null);
  const finishes = results.map((r) => Number(r.positionText)).filter((n) => n > 0);
  const podiums = finishes.filter((n) => n <= 3).length;
  const dnfs = results.filter((r) => !Number(r.positionText)).length;
  const avg = finishes.length ? (finishes.reduce((a, b) => a + b, 0) / finishes.length).toFixed(1) : "–";
  const puRows = pu?.rows.filter((r) => String(r.car) === d?.number) ?? [];
  const maxPts = Math.max(1, ...results.map((r) => Number(r.points)));

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-neutral-800 p-6"
        style={{ background: `linear-gradient(120deg, ${colour}77 0%, ${colour}22 40%, #111113 75%)` }}>
        <span className="pointer-events-none absolute right-48 top-0 font-display text-[12rem] font-bold leading-none opacity-20" style={{ color: colour }}>{d?.number ?? info.permanentNumber}</span>
        <Img src={d?.portrait?.replace("w_440", "w_720")} alt={`${info.givenName} ${info.familyName}`} className="absolute right-4 top-4 hidden h-[200%] w-auto max-w-none drop-shadow-2xl sm:block" />
        <div className="relative max-w-xl">
          <div className="text-lg text-neutral-200">{info.givenName}</div>
          <h1 className="font-display text-6xl font-bold uppercase leading-none">{info.familyName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-300">
            {team && <TeamTag name={team} />}
            <span>{info.nationality}</span>
            <span>Born {new Date(info.dateOfBirth).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Stat label="Champ. pos" value={d ? `P${d.position}` : "–"} />
            <Stat label="Points" value={d?.points ?? "–"} />
            <Stat label="Wins" value={d?.wins ?? "0"} />
            <Stat label="Podiums" value={podiums} />
            <Stat label="Avg finish" value={avg} hint="Average finishing position in races they finished" />
            <Stat label="DNFs" value={dnfs} hint="Retired, disqualified or not classified" />
          </div>
        </div>
      </header>

      <section className="card">
        <h2 className="h2">Season at a glance</h2>
        <p className="muted mb-3 text-xs">Finish in every round. Gold/silver/bronze = podium, green = points, red = did not finish. Bar height = points scored.</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {races.map((r) => {
            const res = r.Results?.[0];
            return (
              <div key={r.round} className="flex w-10 shrink-0 flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end rounded bg-neutral-900">
                  <div className="w-full rounded" style={{ height: `${(Number(res?.points ?? 0) / maxPts) * 100}%`, background: colour }} title={`${res?.points ?? 0} pts`} />
                </div>
                <PosChip text={res?.positionText} status={res?.status} title={`R${r.round} ${r.raceName} · from P${res?.grid}`} />
                <span className="text-[10px] text-neutral-500">R{r.round}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <h2 className="h2">Race results</h2>
          <table className="tbl">
            <thead><tr><th>Rd</th><th>Grand Prix</th><th>Start</th><th>Finish</th><th title="Places gained (+) or lost (−) from the start">+/−</th><th className="text-right">Pts</th></tr></thead>
            <tbody>
              {races.map((r) => {
                const res = r.Results?.[0];
                const delta = res && Number(res.positionText) && Number(res.grid) ? Number(res.grid) - Number(res.positionText) : null;
                return (
                  <tr key={r.round}>
                    <td className="muted">{r.round}</td><td>{r.raceName.replace(" Grand Prix", " GP")}</td>
                    <td className="font-mono">{res?.grid === "0" ? "Pit" : res?.grid}</td>
                    <td><PosChip text={res?.positionText} status={res?.status} /></td>
                    <td className={`font-mono text-xs ${delta == null ? "" : delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-neutral-500"}`}>
                      {delta == null ? <span className="text-neutral-500">{res?.status}</span> : delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : "="}
                    </td>
                    <td className="text-right font-mono">{res?.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <div className="space-y-5 lg:col-span-2">
          {team && (
            <section className="card overflow-hidden">
              <h2 className="h2">Car</h2>
              <Img src={teamCar(team, 300)} alt={`${team} car`} className="h-28 w-full object-contain" />
            </section>
          )}
          {pu && puRows.length > 0 && (
            <section className="card">
              <h2 className="h2">Engine parts used (as of {pu.event})</h2>
              <PuTable rows={puRows} />
              <p className="muted mt-2 text-xs">Each part has a season limit. Amber = at the limit (one more = grid penalty), red = over it. <Link href="/paddock" className="link">Penalties →</Link></p>
            </section>
          )}
          <section className="card">
            <h2 className="h2">In the news</h2>
            {news.length === 0 && <p className="muted text-sm">Nothing recent.</p>}
            <ul className="divide-y divide-neutral-900">
              {news.slice(0, 8).map((n) => (
                <li key={n.link} className="py-2 text-sm"><a href={n.link} target="_blank" rel="noreferrer" className="hover:underline">{n.title}</a> <span className="muted text-xs">— {n.source}</span></li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
