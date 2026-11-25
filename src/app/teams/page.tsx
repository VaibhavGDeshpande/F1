import { TeamCard } from "@/components/Cards";
import { constructorStandings } from "@/lib/jolpica";
import { teamSlug } from "@/lib/media";
import { roster } from "@/lib/roster";

export const metadata = { title: "Teams" };

export default async function Teams() {
  const [teams, drivers] = await Promise.all([constructorStandings(), roster()]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Teams</h1>
        <p className="muted text-sm">Constructors&apos; championship order. Each team scores the points of both its drivers.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => {
          const mine = drivers.filter((d) => d.active && teamSlug(d.team) === teamSlug(t.Constructor.name));
          return (
            <TeamCard key={t.Constructor.constructorId} id={t.Constructor.constructorId} name={t.Constructor.name}
              position={t.positionText} points={t.points} colour={mine[0]?.colour ?? "#888888"} drivers={mine} />
          );
        })}
      </div>
    </div>
  );
}
