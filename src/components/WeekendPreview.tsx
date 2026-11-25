import { Learn } from "./Learn";
import { Gauge, History, Timer, TrendingUp, Trophy } from "lucide-react";
import { fmtLap } from "@/lib/analysis";
import { teamLogo } from "@/lib/media";
import { openf1, type Driver, type Meeting, type Session } from "@/lib/openf1";
import { FAST_ABOVE, SLOW_BELOW, type CornerClass } from "@/lib/preview-calc";
import { weekendPreview } from "@/lib/preview";
import { colourOfTeam } from "@/lib/roster";
import { Stat } from "./Cards";
import { Img } from "./Img";
import { Track3D } from "./Track3D";

const CLS: Record<CornerClass, { label: string; colour: string }> = {
  slow: { label: `Slow (< ${SLOW_BELOW} km/h)`, colour: "#f97316" },
  medium: { label: `Medium (${SLOW_BELOW}–${FAST_ABOVE})`, colour: "#eab308" },
  fast: { label: `Fast (> ${FAST_ABOVE} km/h)`, colour: "#22c55e" },
};

function TeamList({ list, fmt, colour }: { list: { slug: string; name: string; value: number }[]; fmt: (v: number) => string; colour: (n: string) => string }) {
  const max = Math.max(...list.map((x) => Math.abs(x.value)), 1e-9);
  return (
    <ol className="space-y-1.5 text-sm">
      {list.slice(0, 6).map((t, i) => (
        <li key={t.slug} className="flex items-center gap-2">
          <span className="w-4 text-right text-xs text-neutral-500">{i + 1}</span>
          <Img src={teamLogo(t.name, 32)} alt="" className="h-3.5 w-5 object-contain" />
          <span className="w-28 truncate">{t.name}</span>
          <span className="h-1.5 flex-1 rounded-full bg-neutral-900">
            <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(4, (Math.abs(t.value) / max) * 100)}%`, background: colour(t.name) }} />
          </span>
          <span className="w-16 text-right font-mono text-xs">{fmt(t.value)}</span>
        </li>
      ))}
    </ol>
  );
}

export async function WeekendPreview({ meeting, sessions }: { meeting: Meeting; sessions: Session[] }) {
  const [p, latest] = await Promise.all([
    weekendPreview(meeting, sessions),
    openf1<Driver>("drivers", { session_key: "latest" }, 900).catch(() => [] as Driver[]),
  ]);
  const colour = (team: string) => colourOfTeam(latest, team);
  const pr = p.profile;
  const top = p.favourites.slice(0, 3);

  return (
    <section id="preview" className="card space-y-5">
      <div className="flex items-center">
        <h2 className="h2 mb-0 mr-auto text-base"><TrendingUp size={16} />Weekend preview</h2>
        <a href={`/race-sim?meeting=${meeting.meeting_key}`} className="pill pill-on">Simulate race strategies →</a>
      </div>

      <Learn look="note which team you think will win, then check the result after the race. Which part of your reasoning was right?">
        Circuits suit different cars. Long straights reward low drag and engine power; lots of slow corners reward traction and mechanical grip; fast sweeping corners reward
        downforce. Hot track temperatures make tyres overheat, so teams that are kind to their tyres do better there.
      </Learn>
      {pr ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">The track</span>
            {pr.tags.map((t) => <span key={t} className="rounded-full bg-red-600/15 px-2.5 py-0.5 text-xs text-red-300">{t}</span>)}
            <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs">{pr.downforce} downforce</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-black">
            <Track3D points={pr.model} />
            <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-2 text-[10px] text-neutral-400">
              <span>Slow</span><span className="h-1.5 w-24 rounded-full" style={{ background: "linear-gradient(90deg,#f97316,#eab308,#22c55e)" }} /><span>Fast</span>
              <span className="ml-2">· height exaggerated · drag to turn</span>
            </div>
          </div>
          <div className="grid h-fit grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Lap length" value={`${pr.lengthKm.toFixed(2)} km`} />
            <Stat label="Corners" value={pr.corners.length} />
            <Stat label="Full throttle" value={`${pr.fullThrottlePct.toFixed(0)}%`} hint="Share of the lap spent at full throttle" />
            <Stat label="Top speed" value={`${pr.topSpeed}`} hint="km/h on the reference lap" />
            <Stat label="Avg speed" value={`${pr.avgSpeed.toFixed(0)}`} hint="km/h over the reference lap" />
            <Stat label="Braking zones" value={pr.brakingZones} />
            {pr.pitLoss != null && <Stat label="Pit stop loss" value={`${pr.pitLoss.toFixed(1)} s`} hint="Time lost driving through the pit lane (green flag), excluding the stop itself" />}
            <Stat label="Elevation change" value={`${Math.round((Math.max(...pr.model.map((m) => m[2])) - Math.min(...pr.model.map((m) => m[2]))) / 10)} m`} hint="Highest minus lowest point on the lap (from car position data)" />
          </div>
          </div>
          <div>
            <div className="mb-1.5 flex flex-wrap gap-3 text-[11px] text-neutral-400">
              <span>Minimum speed in every corner:</span>
              {(Object.keys(CLS) as CornerClass[]).map((c) => (
                <span key={c} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CLS[c].colour }} />{CLS[c].label}: <b className="text-neutral-200">{pr.counts[c]}</b></span>
              ))}
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {pr.corners.map((c) => (
                <div key={c.label} title={`Turn ${c.label}${c.name ? ` · ${c.name}` : ""}: ${c.speed} km/h`}
                  className="flex w-12 shrink-0 flex-col items-center rounded-md py-1 text-[10px]" style={{ background: `${CLS[c.cls].colour}26`, border: `1px solid ${CLS[c.cls].colour}66` }}>
                  <span className="font-bold">T{c.label}</span>
                  <span className="font-mono">{c.speed}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="muted text-[11px]">
            Measured on the pole lap of the {pr.ref.year} qualifying here ({pr.ref.driver}, {pr.ref.team}, {fmtLap(pr.ref.time)}). Tags and downforce level are
            rules of thumb from these numbers, not team data.
          </p>
        </div>
      ) : <p className="muted text-sm">No qualifying lap at this circuit yet to measure the track from.</p>}

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-800 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Trophy size={14} className="text-amber-300" />Favourites</div>
          {top.length === 0 ? <p className="muted text-sm">Not enough data yet.</p> : (
            <ol className="space-y-2">
              {top.map((t, i) => (
                <li key={t.slug} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: `${colour(t.name)}22` }}>
                  <span className="font-display text-2xl font-bold">{i + 1}</span>
                  <Img src={teamLogo(t.name, 48)} alt="" className="h-5 w-7 object-contain" />
                  <span className="font-semibold">{t.name}</span>
                  <span className="ml-auto font-mono text-xs">{Math.round(t.score * 100)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="muted mt-2 text-[11px]">Score 0–100 blending this weekend&apos;s pace (45%), recent form (35%) and track history (20%), using whatever is available so far.</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Timer size={14} />Pace this weekend</div>
          {p.pace ? <TeamList list={p.pace.list} colour={colour} fmt={(v) => (v ? `+${v.toFixed(3)}` : "fastest")} /> : <p className="muted text-sm">Appears once practice has run.</p>}
          {p.pace && <p className="muted mt-2 text-[11px]">Each team&apos;s best lap in {p.pace.session}. Practice laps vary in fuel and tyres.</p>}
        </div>
        <div className="rounded-xl border border-neutral-800 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Gauge size={14} />Recent form</div>
          {p.form ? <TeamList list={p.form.list} colour={colour} fmt={(v) => `${v} pts`} /> : <p className="muted text-sm">No races yet this season.</p>}
          {p.form && <p className="muted mt-2 text-[11px]">Points scored in the last {p.form.rounds} rounds (incl. sprints).</p>}
        </div>
        <div className="rounded-xl border border-neutral-800 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><History size={14} />Strong here before</div>
          {p.history ? <TeamList list={p.history.list} colour={colour} fmt={(v) => `${v} pts`} /> : <p className="muted text-sm">No past races at this circuit.</p>}
          {p.history && <p className="muted mt-2 text-[11px]">Race points at this circuit in {p.history.years.join(", ")}. Older cars and rules, so treat as a hint.</p>}
        </div>
      </div>
    </section>
  );
}
