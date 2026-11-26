import { seasonUpgrades } from "@/lib/fia";
import { seasonQualifying } from "@/lib/jolpica";
import { teamSlug } from "@/lib/media";
import { beforeAfter, qualiGaps, raceKey } from "@/lib/upgrade-pace";
import { splitReason } from "@/lib/upgrades-parse";
import { Learn } from "./Learn";
import { UpgradeExplorer } from "./UpgradeExplorer";
import { UpgradePace, type PacePoint, type Verdict } from "./UpgradePace";

const short = (race: string) => race.replace(/ Grand Prix.*$/, "");

const KIND_STYLE: Record<string, string> = {
  Performance: "bg-emerald-500/15 text-emerald-300", "Circuit specific": "bg-sky-500/15 text-sky-300",
  Reliability: "bg-amber-500/15 text-amber-300", "Cooling range": "bg-cyan-500/15 text-cyan-300",
};

/** One team's season of declared upgrades (FIA Car Presentation Submissions), with a comparison against the other teams. */
export async function CarUpgrades({ slug, colour }: { slug: string; colour: string }) {
  const [season, quali] = await Promise.all([seasonUpgrades().catch(() => []), seasonQualifying().catch(() => [])]);
  if (!season.length) return <section className="card"><h2 className="h2">Upgrades</h2><p className="muted text-sm">The FIA documents couldn&apos;t be read right now.</p></section>;

  const mine = season.map((e) => ({ eventId: e.eventId, event: e.event, path: e.doc.path, team: e.teams.find((t) => t.slug === slug) }));
  const updates = mine.flatMap((e) => e.team?.updates ?? []);
  const byKind = [...new Set(updates.map((u) => splitReason(u.reason).kind))]
    .map((k) => [k, updates.filter((u) => splitReason(u.reason).kind === k).length] as const).sort((a, b) => b[1] - a[1]);
  const perTeam = [...new Set(season.flatMap((e) => e.teams.map((t) => t.slug)).filter(Boolean))].map((s) => ({
    slug: s!, name: season.flatMap((e) => e.teams).find((t) => t.slug === s)!.team.replace(/\*/g, ""),
    n: season.reduce((sum, e) => sum + (e.teams.find((t) => t.slug === s)?.updates.length ?? 0), 0),
  })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...perTeam.map((t) => t.n));

  // "did it work?": this team's qualifying gap each round beside the parts it brought that weekend
  const byKey = new Map(mine.map((e) => [raceKey(e.event), e.team?.updates ?? []]));
  const rounds = qualiGaps(
    quali.map((r) => ({ round: Number(r.round), race: r.raceName, rows: r.QualifyingResults.map((q) => ({ team: q.Constructor.name, times: [q.Q1, q.Q2, q.Q3] })) })),
    teamSlug,
  ).sort((a, b) => a.round - b.round);
  const points: PacePoint[] = rounds.map((r) => {
    const ups = byKey.get(raceKey(r.race)) ?? [];
    return { race: short(r.race), gap: r.gap[slug] ?? null, parts: ups.length, perf: ups.filter((u) => splitReason(u.reason).kind === "Performance").length };
  });
  const gaps = points.map((p) => p.gap ?? undefined);
  const verdicts: Verdict[] = points.flatMap((p, i) => {
    const ba = p.perf ? beforeAfter(gaps, i) : null;
    return ba ? [{ race: p.race, perf: p.perf, ...ba }] : [];
  });

  return (
    <>
      <section className="card space-y-3">
        <h2 className="h2">Upgrades this season</h2>
        <Learn look="compare where two rival teams spend their upgrades: a team bringing lots of floor parts is chasing downforce; lots of circuit-specific wings means it adapts to each track instead.">
          Every race weekend each team must tell the FIA which parts changed and why. <b>Performance</b> parts are permanent steps forward; <b>circuit specific</b>
          parts suit one type of track (a low-drag wing for Monza or Las Vegas, a high-downforce one for Monaco) and are not really &ldquo;upgrades&rdquo;.
        </Learn>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-neutral-950 p-3 text-center"><div className="font-display text-3xl font-bold">{updates.length}</div><div className="text-xs text-neutral-400">parts declared</div></div>
          <div className="rounded-xl bg-neutral-950 p-3 text-center"><div className="font-display text-3xl font-bold">{mine.filter((e) => e.team?.updates.length).length}<span className="text-base text-neutral-500"> / {season.length}</span></div><div className="text-xs text-neutral-400">events with new parts</div></div>
          <div className="rounded-xl bg-neutral-950 p-3 text-center">
            <div className="flex flex-wrap justify-center gap-1 pt-1">{byKind.map(([k, n]) => <span key={k} className={`rounded-full px-2 py-0.5 text-[11px] ${KIND_STYLE[k] ?? "bg-neutral-800"}`}>{k} {n}</span>)}</div>
            <div className="mt-1 text-xs text-neutral-400">why they changed</div>
          </div>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold text-neutral-300">Parts declared, all teams</h3>
          {perTeam.map((t) => (
            <a key={t.slug} href={`/cars/${t.slug}`} className={`flex items-center gap-2 rounded text-xs hover:bg-neutral-900 ${t.slug === slug ? "font-semibold text-white" : "text-neutral-400"}`}>
              <span className="w-48 shrink-0 truncate">{t.name}</span>
              <div className="h-2.5 flex-1 rounded bg-neutral-900"><div className="h-2.5 rounded" style={{ width: `${(t.n / max) * 100}%`, background: t.slug === slug ? colour : "#3f3f46" }} /></div>
              <span className="w-6 text-right font-mono">{t.n}</span>
            </a>
          ))}
        </div>
      </section>

      {points.some((p) => p.gap != null) && (
        <section className="card space-y-3">
          <h2 className="h2">Did the upgrades work?</h2>
          <Learn look="whether the line steps down after a big dot and stays down. One good weekend proves little: some tracks simply suit a car.">
            Each dot is the team&apos;s best qualifying lap that weekend, as a percentage slower than the fastest lap anyone set (0% = pole). Lower is faster.
            Big dots and dashed lines mark weekends with <b>performance</b> parts (the number is how many).
          </Learn>
          <UpgradePace points={points} verdicts={verdicts} colour={colour} />
        </section>
      )}

      <UpgradeExplorer colour={colour}
        events={mine.map((e) => ({ eventId: e.eventId, event: e.event, path: e.path, pages: e.team?.pages ?? [], updates: e.team?.updates ?? [] }))} />
    </>
  );
}
