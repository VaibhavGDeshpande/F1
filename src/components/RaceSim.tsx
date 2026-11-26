"use client";
import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, RotateCcw, Trophy } from "lucide-react";
import { compoundColour } from "@/lib/openf1";
import { CLIFF, COMPOUNDS, monteCarlo, optimise, strategyName, type Compound, type SimInput, type SimResult } from "@/lib/racesim";
import type { SimDefaults } from "@/lib/racesim-data";
import { TelemetryChart } from "./Charts";
import { Learn } from "./Learn";
import { StintBar, StrategyLab } from "./StrategyLab";

const RUNS = 3000;
const RUNS_TEXT = "3,000"; // fixed text: toLocaleString differs between server and browser locales (hydration mismatch)

function Num({ label, value, onChange, step = 1, min = 0, max, suffix, hint }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; hint?: string;
}) {
  return (
    <label className="block text-xs" title={hint}>
      {label && <span className="text-neutral-400">{label}</span>}
      <span className="mt-1 flex items-center gap-1">
        <input type="number" className="select w-full py-1.5 font-mono" value={Number(value.toFixed(3))} step={step} min={min} max={max} aria-label={label || hint}
          onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
        {suffix && <span className="text-neutral-500">{suffix}</span>}
      </span>
    </label>
  );
}

export function RaceSim({ defaults, meetings, meetingKey, title }: {
  defaults: SimDefaults; meetings: { key: number; name: string }[]; meetingKey: number; title: string;
}) {
  const router = useRouter();
  const [inp, setInp] = useState<SimInput>(defaults.input);
  const deferred = useDeferredValue(inp); // typing stays smooth while the 3,000 races re-run
  const safe = useMemo(() => ({ ...deferred, laps: Math.round(deferred.laps) }), [deferred]);
  const results = useMemo(() => (safe.laps < 15 || safe.laps > 90 ? [] : monteCarlo(safe, optimise(safe).slice(0, 8), RUNS)), [safe]);
  const set = (patch: Partial<SimInput>) => setInp((x) => ({ ...x, ...patch }));
  const setTyre = (c: Compound, k: "pace" | "deg" | "life", v: number) => setInp((x) => ({ ...x, tyres: { ...x.tyres, [c]: { ...x.tyres[c], [k]: v } } }));
  const best = results[0], laps = Math.round(inp.laps);
  // the best *average* plan isn't always the one that is fastest most often (a plan can usually win but sometimes lose big)
  const mostWins = results.reduce<SimResult | undefined>((a, r) => (!a || r.winPct > a.winPct ? r : a), undefined);
  const stale = deferred !== inp;
  const label = (c: Compound) => c[0] + c.slice(1).toLowerCase();

  const curves = COMPOUNDS.map((c) => ({
    name: c, colour: compoundColour(c),
    data: Array.from({ length: Math.min(laps, Math.round(inp.tyres[c].life) + 12) }, (_, age) => ({
      x: age, y: inp.tyres[c].pace + inp.tyres[c].deg * age + CLIFF * Math.max(0, age - inp.tyres[c].life),
    })),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="h1 flex items-center gap-3"><FlaskConical size={30} />Race simulator</h1>
          <p className="muted text-sm">Finds the fastest tyre strategy, then races it {RUNS_TEXT} times with random safety cars to see how often it actually wins.</p>
        </div>
        <select className="select min-w-64" value={meetingKey} aria-label="Grand Prix" onChange={(e) => router.push(`/race-sim?meeting=${e.target.value}`)}>
          {meetings.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
        </select>
      </div>

      {best && (
        <section className="card flex flex-wrap items-center gap-x-8 gap-y-2" style={{ background: "linear-gradient(120deg,#7f1d1d55,#111113 60%)" }}>
          <Trophy className="text-amber-300" size={32} />
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-400">Best plan · {title}</div>
            <div className="font-display text-3xl font-bold uppercase">{strategyName(best)}</div>
            <div className="text-sm text-neutral-300">
              {["", "One stop", "Two stops", "Three stops"][best.stops.length]} on lap {best.stops.join(" & ")}
              {" "}· pit window {best.window.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(" & ")}
            </div>
            {mostWins && mostWins !== best && (
              <div className="mt-1 text-xs text-amber-300">
                Best on average, but <b>{strategyName(mostWins)}</b> is the fastest plan in more races ({mostWins.winPct.toFixed(0)}%). It loses more when a safety car hits at the wrong time.
              </div>
            )}
          </div>
          <div className="ml-auto flex gap-6 text-center">
            <div><div className="font-display text-4xl font-bold text-emerald-400">{best.winPct.toFixed(0)}%</div><div className="text-[11px] text-neutral-400">of races it&apos;s the fastest plan</div></div>
            {results[1] && <div><div className="font-display text-4xl font-bold">+{results[1].mean.toFixed(1)}s</div><div className="text-[11px] text-neutral-400">next best: {strategyName(results[1])}</div></div>}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="card space-y-4">
          <div className="flex items-center">
            <h2 className="h2 mb-0 mr-auto">Inputs</h2>
            <button className="pill flex items-center gap-1" onClick={() => setInp(defaults.input)}><RotateCcw size={12} />Reset to data</button>
          </div>
          <Learn look="change one number at a time and see what happens to the best plan at the top.">
            These numbers come from this season&apos;s real data for this circuit. <b>Pit stop loss</b> is the time lost driving through the pit lane compared with staying out.
            A high loss (a long pit lane) favours fewer stops. <b>Pace</b>, <b>wear</b> and <b>life</b> describe each tyre.
          </Learn>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Race laps" value={inp.laps} onChange={(v) => set({ laps: v })} min={15} max={90} hint={defaults.sources.laps} />
            <Num label="Safety car chance" value={inp.scChance * 100} onChange={(v) => set({ scChance: Math.min(99, Math.max(0, v)) / 100 })} max={99} suffix="%" hint={defaults.sources.sc} />
            <Num label="Pit stop loss" value={inp.pitLoss} onChange={(v) => set({ pitLoss: v })} step={0.5} suffix="s" hint={defaults.sources.pit} />
            <Num label="…under safety car" value={inp.pitLossSC} onChange={(v) => set({ pitLossSC: v })} step={0.5} suffix="s" hint="Cheaper because the field is driving slowly" />
            <Num label="Max laps per tyre set" value={inp.maxStint ?? 0} onChange={(v) => set({ maxStint: Math.max(0, Math.round(v)) })} suffix={inp.maxStint ? "laps" : "none"}
              hint={`${defaults.sources.maxStint}. Some races have a Pirelli safety limit; it can force an extra stop.`} />
          </div>
          <div>
            <div className="mb-1 grid grid-cols-[70px_1fr_1fr_1fr] gap-2 text-[11px] text-neutral-400">
              <span /><span title="Seconds per lap slower than the fastest compound, on new tyres">Pace (+s)</span>
              <span title="Seconds lost per lap for every lap of tyre age">Wear (s/lap)</span><span title="Laps before the tyre falls off a cliff">Life (laps)</span>
            </div>
            {COMPOUNDS.map((c) => (
              <div key={c} className="mb-2 grid grid-cols-[70px_1fr_1fr_1fr] items-end gap-2">
                <span className="flex items-center gap-1.5 pb-2 text-xs font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: compoundColour(c) }} />{label(c)}</span>
                <Num label="" hint={`${label(c)} pace (+s)`} value={inp.tyres[c].pace} onChange={(v) => setTyre(c, "pace", v)} step={0.05} min={-1} />
                <Num label="" hint={`${label(c)} wear (s/lap)`} value={inp.tyres[c].deg} onChange={(v) => setTyre(c, "deg", Math.max(0, v))} step={0.005} />
                <Num label="" hint={`${label(c)} life (laps)`} value={inp.tyres[c].life} onChange={(v) => setTyre(c, "life", Math.max(1, v))} />
              </div>
            ))}
          </div>
          <ul className="space-y-0.5 text-[11px] text-neutral-500">
            <li>Laps: {defaults.sources.laps}</li>
            <li>Pit loss: {defaults.sources.pit}</li>
            <li>Tyres: {defaults.sources.tyres}</li>
            <li>Safety car: {defaults.sources.sc}</li>
            <li>Max laps per set: {defaults.sources.maxStint}</li>
          </ul>
        </section>

        <div className="space-y-4">
          <section className={`card transition-opacity ${stale ? "opacity-60" : ""}`}>
            <h2 className="h2">Strategies ranked</h2>
            <Learn className="mb-3" look="raise the safety car chance to 80% and watch the Likely range and Fastest in columns: with more safety cars, luck decides more of the race.">
              <b>Avg vs best</b> is the average race time gap. <b>Likely range</b> shows how much luck matters: a wide range means safety cars can make or break the plan.
              <b> Fastest in</b> counts how often a plan wins outright. The white box on each bar is the <b>pit window</b>: stopping anywhere inside it costs under 1 s.
            </Learn>
            {results.length === 0 ? <p className="muted text-sm">Race laps must be between 15 and 90.</p> : (
              <div className="overflow-x-auto">
                <table className="tbl text-sm">
                  <thead>
                    <tr>
                      <th>#</th><th>Strategy</th><th className="w-1/3">Stints <span className="font-normal text-neutral-500">(white = pit window)</span></th>
                      <th className="text-right" title="Average race time compared with the best plan">Avg vs best</th>
                      <th className="text-right" title="10% of races are better than the first number, 10% worse than the second">Likely range</th>
                      <th className="text-right" title="Share of simulated races in which this was the fastest plan">Fastest in</th>
                      <th className="text-right" title="Share of races in which at least one stop could be made under a safety car">SC stop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.seq.join() + r.stops.join()}>
                        <td className="text-neutral-500">{i + 1}</td>
                        <td className="whitespace-nowrap">
                          <b>{strategyName(r)}</b>
                          <div className="text-[11px] text-neutral-400">stop lap {r.stops.join(", ")} · window {r.window.map(([a, b]) => `${a}–${b}`).join(", ")}</div>
                        </td>
                        <td><StintBar r={r} laps={laps} /></td>
                        <td className="text-right font-mono">{i === 0 ? "best" : `+${r.mean.toFixed(1)} s`}</td>
                        <td className="whitespace-nowrap text-right font-mono text-xs text-neutral-400">{r.p10 >= 0 ? "+" : ""}{r.p10.toFixed(1)} … +{r.p90.toFixed(1)}</td>
                        <td className="text-right">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-12 rounded-full bg-neutral-900"><span className="block h-1.5 rounded-full bg-emerald-500" style={{ width: `${r.winPct}%` }} /></span>
                            <span className="w-10 font-mono">{r.winPct.toFixed(0)}%</span>
                          </span>
                        </td>
                        <td className="text-right font-mono text-xs text-neutral-400">{r.scStopPct.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {results.length > 0 && <StrategyLab inp={safe} best={best} runs={RUNS} />}

          <section className="card">
            <h2 className="h2">Lap time by tyre age</h2>
            <Learn className="mb-2" look="make the soft's life 10 laps shorter in the inputs. Its curve bends earlier, and the best plan stops sooner or switches to a harder tyre.">
              Softer tyres start faster but wear quicker. Where two curves cross, the harder tyre becomes the faster one: that crossing is roughly when a team wants to stop.
            </Learn>
            <p className="muted mb-2 text-xs">How much slower each compound is than a new soft as it wears. The steep bend at the end is the cliff, after the usable life.</p>
            <TelemetryChart xLabel="laps old" xTitle="Tyre age (laps)" yTitle="Slower than new soft (s)" unit="s" height={220} lines={curves} />
          </section>

          <section className="card text-xs leading-relaxed text-neutral-400">
            <h2 className="h2 text-neutral-200">How it works</h2>
            <p>
              <b className="text-neutral-200">1. Optimiser:</b> tries every legal 1-stop and 2-stop plan, plus 3-stop when a per-set lap limit is on (at least two different dry compounds, stints of 5+ laps) on every
              stop lap and keeps the fastest stop laps for each compound order. A lap costs <i>pace + wear × tyre age</i>, plus {CLIFF} s for every lap past the
              tyre&apos;s life; each stop costs the pit loss. Fuel burn is the same whatever the strategy, so it cancels out.
            </p>
            <p className="mt-2">
              <b className="text-neutral-200">2. Monte Carlo:</b> races the top 8 plans {RUNS_TEXT} times. Safety cars (3–5 laps) appear at random so that
              {" "}{(inp.scChance * 100).toFixed(0)}% of races get at least one. When one comes out up to 8 laps before a planned stop, the team pits under it and the stop
              costs the cheaper safety-car pit loss. Every plan faces the same safety cars in each race, so the comparison is fair.
            </p>
            <p className="mt-2">It plans for one car in clean air: no traffic, no track position, no weather. Treat the numbers as a guide, not a prediction.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
