import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Box, ExternalLink } from "lucide-react";
import { CarUpgrades } from "@/components/CarUpgrades";
import { Img } from "@/components/Img";
import { PuTable } from "@/components/PuTable";
import { CARS_2026, RULES_2026, SOURCES, TEAM_SHEETS } from "@/lib/car-specs";
import { latestPuUsage } from "@/lib/fia";
import { constructorStandings } from "@/lib/jolpica";
import { teamCar, teamLogo, teamSlug } from "@/lib/media";
import { roster } from "@/lib/roster";

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const car = CARS_2026[team];
  return { title: car ? `${car.chassis} specs & upgrades` : "Car" };
}

async function PuUsage({ numbers }: { numbers: string[] }) {
  const pu = await latestPuUsage().catch(() => null);
  const rows = pu?.rows.filter((r) => numbers.includes(String(r.car))) ?? [];
  if (!pu || !rows.length) return null;
  return (
    <section className="card">
      <h2 className="h2">Power unit parts used (as of {pu.event})</h2>
      <PuTable rows={rows} />
      <p className="muted mt-2 text-xs">Each driver has a season limit per element; one more than allowed means a grid penalty.</p>
    </section>
  );
}

const Source = ({ k }: { k: keyof typeof SOURCES }) => (
  <a href={SOURCES[k].url} target="_blank" rel="noreferrer" title={SOURCES[k].label} className="text-neutral-600 hover:text-neutral-300"><ExternalLink size={10} className="inline" /></a>
);

export default async function CarPage({ params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params;
  const car = CARS_2026[slug];
  if (!car) notFound();
  const [drivers, standings] = await Promise.all([roster().catch(() => []), constructorStandings().catch(() => [])]);
  const mine = drivers.filter((d) => d.active && teamSlug(d.team) === slug);
  const constructor = standings.find((s) => teamSlug(s.Constructor.name) === slug)?.Constructor;
  const name = constructor?.name ?? mine[0]?.team ?? slug;
  const colour = mine[0]?.colour ?? "#888888";
  const groups = [...new Set(RULES_2026.map((r) => r.group))];
  const sheet = TEAM_SHEETS[slug];

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-neutral-800 p-6"
        style={{ background: `linear-gradient(120deg, ${colour}77 0%, ${colour}22 45%, #111113 80%)` }}>
        <div className="relative z-10 max-w-xl">
          <Img src={teamLogo(name, 96)} alt={`${name} logo`} className="mb-3 h-10 w-auto" />
          <h1 className="font-display text-6xl font-bold uppercase leading-none">{car.chassis}</h1>
          <div className="mt-2 text-sm text-neutral-300">{name} · {car.pu} power unit</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/cars?team=${slug}`} className="pill flex items-center gap-1"><Box size={12} />3D model</Link>
            {constructor && <Link href={`/teams/${constructor.constructorId}`} className="pill">Team results</Link>}
          </div>
        </div>
        <Img src={teamCar(name, 400)} alt={`${name} car`} className="mt-4 h-32 w-full object-contain lg:absolute lg:bottom-6 lg:right-6 lg:mt-0 lg:h-44 lg:w-[45%]" />
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">Built to the 2026 rules</h2>
          <p className="muted mb-2 text-xs">What every car on the grid shares, because the FIA rules fix it. Teams keep the real details of their parts secret.</p>
          {groups.map((g) => (
            <table key={g} className="tbl mb-3 text-xs">
              <thead><tr><th colSpan={2}>{g}</th></tr></thead>
              <tbody>
                {RULES_2026.filter((r) => r.group === g).map((r) => (
                  <tr key={r.item}>
                    <td className="w-44 text-neutral-400">{r.item}</td>
                    <td><b className="text-neutral-100">{r.value}</b>{r.note && <span className="text-neutral-500"> · {r.note}</span>} <Source k={r.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </section>

        <section className="card">
          <h2 className="h2">This car</h2>
          <table className="tbl mb-3 text-xs">
            <tbody>
              <tr><td className="w-44 text-neutral-400">Chassis</td><td><b>{car.chassis}</b> <Source k="entry" /></td></tr>
              <tr><td className="text-neutral-400">Power unit</td><td><b>{car.pu}</b> <Source k="entry" /></td></tr>
              {mine.map((d) => <tr key={d.id}><td className="text-neutral-400">Car #{d.number}</td><td>{d.given} {d.family}</td></tr>)}
            </tbody>
          </table>
          {sheet ? (
            <>
              <h3 className="mb-1 text-xs font-semibold text-neutral-300">Spec sheet published by the team <Source k="w17" /></h3>
              <table className="tbl text-xs"><tbody>{sheet.map((r) => <tr key={r.item}><td className="w-44 text-neutral-400">{r.item}</td><td>{r.value}</td></tr>)}</tbody></table>
            </>
          ) : (
            <p className="muted text-xs">This team doesn&apos;t publish a detailed spec sheet. The rules on the left still fix most of the car; the upgrades below show which parts it has changed.</p>
          )}
        </section>
      </div>

      <Suspense fallback={<section className="card"><h2 className="h2">Upgrades this season</h2><p className="muted animate-pulse text-sm">Reading this season&apos;s FIA upgrade documents… (the first visit takes a minute)</p></section>}>
        <CarUpgrades slug={slug} colour={colour} />
      </Suspense>
      <Suspense fallback={null}><PuUsage numbers={mine.map((d) => d.number)} /></Suspense>
    </div>
  );
}
