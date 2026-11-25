import Link from "next/link";
import { teamCar, teamLogo } from "@/lib/media";
import type { RosterDriver } from "@/lib/roster";
import { Img } from "./Img";

/** Portrait card: team-colour gradient, big race number, driver photo, standing. */
export function DriverCard({ d }: { d: RosterDriver }) {
  return (
    <Link href={`/drivers/${d.id}`} className="group relative block h-60 overflow-hidden rounded-2xl border border-neutral-800 transition hover:-translate-y-0.5 hover:border-neutral-600"
      style={{ background: `linear-gradient(140deg, ${d.colour}66 0%, ${d.colour}22 45%, #111113 80%)` }}>
      <span className="pointer-events-none absolute -right-1 -top-3 font-display text-[8rem] font-bold leading-none opacity-25" style={{ color: d.colour }}>{d.number}</span>
      {/* formula1.com portraits are full-body: scale up and anchor to the top to show head and shoulders */}
      <Img src={d.portrait} alt={`${d.given} ${d.family}`} className="absolute -right-6 top-2 h-[210%] w-auto max-w-none origin-top drop-shadow-2xl transition duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#111113]/90 via-[#111113]/30 to-transparent" />
      <div className="relative flex h-full flex-col p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md bg-black/40 px-2 py-0.5 font-bold">P{d.position}</span>
          <span className="font-mono text-neutral-200">{d.points} pts</span>
          {Number(d.wins) > 0 && <span className="text-amber-300">· {d.wins} {Number(d.wins) === 1 ? "win" : "wins"}</span>}
        </div>
        <div className="mt-auto">
          <div className="text-sm text-neutral-300">{d.given}</div>
          <div className="font-display text-3xl font-bold uppercase leading-none">{d.family}</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-neutral-300">
            <Img src={d.logo} alt="" className="h-4 w-auto" />{d.team}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Team card: colour gradient, logo, car render, both drivers. */
export function TeamCard({ id, name, position, points, colour, drivers }: {
  id: string; name: string; position: string; points: string; colour: string; drivers: RosterDriver[];
}) {
  return (
    <Link href={`/teams/${id}`} className="group relative block overflow-hidden rounded-2xl border border-neutral-800 p-4 transition hover:-translate-y-0.5 hover:border-neutral-600"
      style={{ background: `linear-gradient(160deg, ${colour}55, #111113 65%)` }}>
      <div className="flex items-start gap-3">
        <Img src={teamLogo(name, 64)} alt={`${name} logo`} className="h-8 w-auto" />
        <div className="min-w-0">
          <div className="font-display text-2xl font-bold uppercase leading-none">{name}</div>
          <div className="mt-1 text-xs text-neutral-300">P{position} · <span className="font-mono">{points}</span> pts</div>
        </div>
      </div>
      <Img src={teamCar(name, 220)} alt={`${name} car`} className="mx-auto my-3 h-24 w-full object-contain transition duration-300 group-hover:translate-x-2" />
      <div className="flex gap-3">
        {drivers.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <Img src={d.headshot} alt="" className="h-8 w-8 rounded-full bg-black/40 object-cover" />
            <span className="text-sm"><span className="text-neutral-400">{d.given.split(" ")[0]}</span> <b>{d.family}</b></span>
          </div>
        ))}
      </div>
      <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: colour }} />
    </Link>
  );
}

/** Finishing position as a coloured chip: podium gold/silver/bronze, points green, retirements red. */
export function PosChip({ text, status, title }: { text?: string; status?: string; title?: string }) {
  const n = Number(text);
  const cls = !text ? "bg-neutral-900 text-neutral-600"
    : n === 1 ? "bg-amber-400 text-black" : n === 2 ? "bg-neutral-300 text-black" : n === 3 ? "bg-orange-700 text-white"
    : n <= 10 ? "bg-emerald-600/25 text-emerald-300" : n ? "bg-neutral-800 text-neutral-300" : "bg-red-600/25 text-red-300";
  const label = !text ? "–" : n ? `P${n}` : { R: "DNF", D: "DSQ", W: "DNS", N: "NC", F: "DNQ", E: "EXC" }[text] ?? text;
  return <span title={[title, status].filter(Boolean).join(" · ")} className={`inline-grid h-7 min-w-10 place-items-center rounded-md px-1 font-mono text-xs font-bold ${cls}`}>{label}</span>;
}

/** Big number with a small label. */
export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-black/30 px-4 py-3" title={hint}>
      <div className="font-display text-3xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
    </div>
  );
}

/** Small team logo + name. */
export function TeamTag({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Img src={teamLogo(name, 32)} alt="" className="h-3.5 w-auto opacity-90" />{name}
    </span>
  );
}
