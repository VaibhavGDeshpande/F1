import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamTag } from "@/components/Cards";
import { Img } from "@/components/Img";
import { constructorStandings, driverStandings, SAFE_SEASON } from "@/lib/jolpica";
import { teamSlug } from "@/lib/media";
import { roster } from "@/lib/roster";

export const metadata = { title: "Standings" };

const Bar = ({ value, max, colour }: { value: number; max: number; colour: string }) => (
  <span className="block h-1.5 w-full rounded-full bg-neutral-900">
    <span className="block h-1.5 rounded-full" style={{ width: `${(value / (max || 1)) * 100}%`, background: colour }} />
  </span>
);

export default async function Standings({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season = "current" } = await searchParams;
  if (!SAFE_SEASON.test(season)) notFound();
  const current = season === "current" || Number(season) === new Date().getUTCFullYear();
  const [drivers, teams, people] = await Promise.all([driverStandings(season), constructorStandings(season), current ? roster().catch(() => []) : []]);
  const leader = Number(drivers[0]?.points ?? 0), teamLeader = Number(teams[0]?.points ?? 0);
  const colourOf = (team: string) => people.find((p) => teamSlug(p.team) === teamSlug(team))?.colour ?? "#888888";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="h1">Standings {current ? "" : season}</h1>
          <p className="muted text-sm">Points: 25-18-15-12-10-8-6-4-2-1 for the top ten in each race, plus sprint points. Bars compare everyone to the leader.</p>
        </div>
        <form className="flex items-center gap-2">
          <input name="season" placeholder="Season, e.g. 2008" className="select w-40" aria-label="Season" />
          <button className="pill pill-on">Go</button>
        </form>
      </div>
      <div className="grid gap-5 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <h2 className="h2">Drivers</h2>
          <table className="tbl">
            <thead><tr><th className="w-8">#</th><th>Driver</th><th className="w-1/3">Points</th><th className="text-right">Gap</th><th className="text-right">Wins</th></tr></thead>
            <tbody>
              {drivers.map((s) => {
                const p = people.find((x) => x.id === s.Driver.driverId);
                const team = p?.team ?? s.Constructors.at(-1)?.name ?? "";
                const pts = Number(s.points);
                return (
                  <tr key={s.Driver.driverId}>
                    <td className={`font-bold ${Number(s.positionText) <= 3 ? "text-amber-300" : "text-neutral-400"}`}>{s.positionText}</td>
                    <td>
                      <Link href={`/drivers/${s.Driver.driverId}`} className="flex items-center gap-2 hover:underline">
                        <Img src={p?.headshot} alt="" className="h-8 w-8 rounded-full object-cover" fallback={<span className="h-8 w-8 rounded-full bg-neutral-800" />} />
                        <span className="leading-tight">
                          <b>{s.Driver.givenName} {s.Driver.familyName}</b>
                          <TeamTag name={team} className="block text-xs text-neutral-400" />
                        </span>
                      </Link>
                    </td>
                    <td><div className="flex items-center gap-2"><span className="w-10 font-mono">{s.points}</span><Bar value={pts} max={leader} colour={p?.colour ?? colourOf(team)} /></div></td>
                    <td className="text-right font-mono text-xs text-neutral-400">{pts === leader ? "Leader" : `−${leader - pts}`}</td>
                    <td className="text-right">{s.wins}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="card xl:col-span-2">
          <h2 className="h2">Constructors</h2>
          <ul className="space-y-3">
            {teams.map((s) => {
              const pts = Number(s.points);
              return (
                <li key={s.Constructor.constructorId}>
                  <Link href={`/teams/${s.Constructor.constructorId}`} className="flex items-center gap-2 text-sm hover:underline">
                    <span className="w-5 font-bold text-neutral-400">{s.positionText}</span>
                    <TeamTag name={s.Constructor.name} className="font-semibold" />
                    <span className="ml-auto font-mono">{s.points}</span>
                    <span className="w-14 text-right font-mono text-xs text-neutral-500">{pts === teamLeader ? "" : `−${teamLeader - pts}`}</span>
                  </Link>
                  <div className="mt-1 pl-7"><Bar value={pts} max={teamLeader} colour={colourOf(s.Constructor.name)} /></div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
