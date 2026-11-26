import { notFound } from "next/navigation";
import { DriverCard, PosChip, Stat } from "@/components/Cards";
import { Img } from "@/components/Img";
import { constructorInfo, constructorResults, constructorStandings, SAFE_ID } from "@/lib/jolpica";
import { teamCar, teamLogo, teamSlug } from "@/lib/media";
import { getNews } from "@/lib/news";
import { roster } from "@/lib/roster";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SAFE_ID.test(id)) notFound();
  const info = await constructorInfo(id);
  if (!info) notFound();
  const [races, standings, drivers, news] = await Promise.all([
    constructorResults(id), constructorStandings(), roster().catch(() => []), getNews({ q: info.name.split(" ")[0] }),
  ]);
  const st = standings.find((s) => s.Constructor.constructorId === id);
  const mine = drivers.filter((d) => d.active && teamSlug(d.team) === teamSlug(info.name));
  const colour = mine[0]?.colour ?? "#888888";
  const raced = [...new Map(races.flatMap((r) => r.Results ?? []).map((r) => [r.Driver.driverId, r.Driver])).values()];
  const all = races.flatMap((r) => r.Results ?? []);
  const podiums = all.filter((r) => Number(r.positionText) <= 3 && Number(r.positionText) > 0).length;
  const dnfs = all.filter((r) => !Number(r.positionText)).length;

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-neutral-800 p-6"
        style={{ background: `linear-gradient(120deg, ${colour}77 0%, ${colour}22 45%, #111113 80%)` }}>
        <div className="relative z-10 max-w-xl">
          <Img src={teamLogo(info.name, 96)} alt={`${info.name} logo`} className="mb-3 h-12 w-auto" />
          <h1 className="font-display text-6xl font-bold uppercase leading-none">{info.name}</h1>
          <div className="mt-2 text-sm text-neutral-300">{info.nationality}</div>
          {teamSlug(info.name) && <a href={`/cars/${teamSlug(info.name)}`} className="pill mt-3 inline-block">Car specs &amp; upgrades →</a>}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Position" value={st ? `P${st.positionText}` : "–"} />
            <Stat label="Points" value={st?.points ?? "–"} />
            <Stat label="Wins" value={st?.wins ?? "0"} />
            <Stat label="Podiums" value={podiums} />
            <Stat label="DNFs" value={dnfs} />
          </div>
        </div>
        <Img src={teamCar(info.name, 400)} alt={`${info.name} car`} className="mt-4 h-32 w-full object-contain lg:absolute lg:bottom-6 lg:right-6 lg:mt-0 lg:h-44 lg:w-[45%]" />
      </header>

      {mine.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{mine.map((d) => <DriverCard key={d.id} d={d} />)}</div>}

      <section className="card overflow-x-auto">
        <h2 className="h2">Results this season</h2>
        <p className="muted mb-2 text-xs">Each driver&apos;s finish per round. Hover a chip for the starting position and status.</p>
        <table className="tbl">
          <thead><tr><th>Rd</th><th>Grand Prix</th>{raced.map((d) => <th key={d.driverId}>{d.code ?? d.familyName}</th>)}<th className="text-right">Team pts</th></tr></thead>
          <tbody>
            {races.map((r) => (
              <tr key={r.round}>
                <td className="muted">{r.round}</td><td>{r.raceName.replace(" Grand Prix", " GP")}</td>
                {raced.map((d) => {
                  const res = r.Results?.find((x) => x.Driver.driverId === d.driverId);
                  return <td key={d.driverId}><PosChip text={res?.positionText} status={res?.status} title={res ? `from P${res.grid}` : undefined} /></td>;
                })}
                <td className="text-right font-mono">{(r.Results ?? []).reduce((t, x) => t + Number(x.points), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="h2">In the news</h2>
        <ul className="divide-y divide-neutral-900">
          {news.slice(0, 8).map((n) => (
            <li key={n.link} className="py-2 text-sm"><a href={n.link} target="_blank" rel="noreferrer" className="hover:underline">{n.title}</a> <span className="muted text-xs">— {n.source}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
