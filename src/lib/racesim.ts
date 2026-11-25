// Race strategy simulator (pure, unit-tested in racesim.test.ts): exhaustive 1- and 2-stop optimiser plus a Monte Carlo
// of safety cars. Times are relative (fuel burn is identical for every strategy, so it cancels out and is left out).

export const COMPOUNDS = ["SOFT", "MEDIUM", "HARD"] as const;
export type Compound = (typeof COMPOUNDS)[number];
/** pace = s/lap slower than the fastest compound when new; deg = s/lap lost per lap of age; life = laps before the cliff. */
export type TyreModel = Record<Compound, { pace: number; deg: number; life: number }>;
export type SimInput = {
  laps: number; pitLoss: number; pitLossSC: number; scChance: number; tyres: TyreModel;
  maxStint?: number; // Pirelli's per-set lap limit at some circuits (e.g. Qatar); 0/undefined = none
};
export type Strategy = { seq: Compound[]; stops: number[]; time: number }; // stops = laps at whose end the car pits
export type SimResult = Strategy & {
  mean: number; p10: number; p90: number; winPct: number; scStopPct: number; window: [number, number][];
};

export const CLIFF = 0.25; // extra s/lap for every lap a tyre runs beyond its usable life
export const MIN_STINT = 5;
const SC_REACT = 8; // a team brings a planned stop forward by up to this many laps to pit under a safety car

/** cost[c][n] = time n laps on a fresh set of compound c take, relative to a new fastest tyre with no wear. */
export function stintCosts(t: TyreModel, maxLaps: number): Record<Compound, Float64Array> {
  const out = {} as Record<Compound, Float64Array>;
  for (const c of COMPOUNDS) {
    const a = new Float64Array(maxLaps + 1);
    for (let n = 1; n <= maxLaps; n++) {
      const age = n - 1;
      a[n] = a[n - 1] + t[c].pace + t[c].deg * age + CLIFF * Math.max(0, age - t[c].life);
    }
    out[c] = a;
  }
  return out;
}

/** Every compound order of length k that uses at least two different compounds (dry-race rule). */
function sequences(k: number): Compound[][] {
  let all: Compound[][] = [[]];
  for (let i = 0; i < k; i++) all = all.flatMap((s) => COMPOUNDS.map((c) => [...s, c]));
  return all.filter((s) => new Set(s).size >= 2);
}

const raceTime = (cost: Record<Compound, Float64Array>, seq: Compound[], stops: number[], laps: number) => {
  let t = 0, from = 0;
  seq.forEach((c, i) => { const to = i < stops.length ? stops[i] : laps; t += cost[c][to - from]; from = to; });
  return t;
};

/** A stint length is allowed: at least MIN_STINT laps and within the per-set limit (if any). */
const okStint = (inp: SimInput, n: number) => n >= MIN_STINT && (!inp.maxStint || n <= inp.maxStint);
const okStops = (inp: SimInput, stops: number[]) => [0, ...stops, inp.laps].every((x, i, a) => !i || okStint(inp, x - a[i - 1]));

/** Fastest stop laps for every 1- and 2-stop compound order (and 3-stop when a stint limit is set), best first, no safety cars. */
export function optimise(inp: SimInput): Strategy[] {
  const L = inp.laps, cost = stintCosts(inp.tyres, L), out: Strategy[] = [];
  const search = (stops: number) => {
    for (const seq of sequences(stops + 1)) {
      let best: Strategy | null = null;
      const walk = (chosen: number[]) => {
        if (chosen.length === stops) {
          if (!okStops(inp, chosen)) return;
          const time = raceTime(cost, seq, chosen, L) + stops * inp.pitLoss;
          if (!best || time < best.time) best = { seq, stops: chosen, time };
          return;
        }
        const from = (chosen.at(-1) ?? 0) + MIN_STINT, to = L - (stops - chosen.length) * MIN_STINT;
        for (let s = from; s <= to; s++) walk([...chosen, s]);
      };
      walk([]);
      if (best) out.push(best);
    }
  };
  search(1);
  search(2);
  if (inp.maxStint) search(3); // a tight per-set limit can force a third stop
  return out.sort((x, y) => x.time - y.time);
}

/** For each stop: the range of laps that keeps the strategy within `slack` seconds of its best (others fixed). */
export function pitWindows(inp: SimInput, s: Strategy, slack = 1): [number, number][] {
  const cost = stintCosts(inp.tyres, inp.laps), extra = s.stops.length * inp.pitLoss;
  return s.stops.map((_, i) => {
    const lo = i ? s.stops[i - 1] + MIN_STINT : MIN_STINT, hi = i < s.stops.length - 1 ? s.stops[i + 1] - MIN_STINT : inp.laps - MIN_STINT;
    let from = s.stops[i], to = s.stops[i];
    for (let l = lo; l <= hi; l++) {
      const stops = s.stops.map((x, j) => (j === i ? l : x));
      if (okStops(inp, stops) && raceTime(cost, s.seq, stops, inp.laps) + extra <= s.time + slack) { from = Math.min(from, l); to = Math.max(to, l); }
    }
    return [from, to];
  });
}

/** Small seeded RNG (mulberry32) so results are stable between renders and in tests. */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Runs `n` races with random safety cars (each lasting 3–5 laps; chance per race = scChance). In each race every strategy
 * meets the same safety cars; a planned stop is brought forward to a safety car up to SC_REACT laps earlier and then
 * costs pitLossSC. Returns each strategy's average time (relative to the best average), spread and win rate.
 */
export function monteCarlo(inp: SimInput, strats: Strategy[], n = 3000, seed = 42): SimResult[] {
  const L = inp.laps, cost = stintCosts(inp.tyres, L), rand = rng(seed);
  const p = Math.min(0.99, Math.max(0, inp.scChance));
  const hazard = 1 - (1 - p) ** (1 / L); // per-lap chance a safety car starts, so P(≥1 per race) ≈ scChance
  const times = strats.map(() => new Float64Array(n)), wins = new Array(strats.length).fill(0), scStops = new Array(strats.length).fill(0);
  const sc = new Uint8Array(L + 1);

  for (let k = 0; k < n; k++) {
    sc.fill(0);
    for (let lap = 1; lap <= L; lap++) {
      if (rand() < hazard) { const d = 3 + Math.floor(rand() * 3); for (let j = lap; j < lap + d && j <= L; j++) sc[j] = 1; lap += d; }
    }
    let bestI = 0;
    strats.forEach((s, i) => {
      const stops = [...s.stops];
      let pit = 0, usedSC = false;
      for (let j = 0; j < stops.length; j++) {
        const prev = j ? stops[j - 1] : 0;
        let moved = -1;
        const next = j < stops.length - 1 ? stops[j + 1] : L;
        for (let lap = Math.max(prev + MIN_STINT, stops[j] - SC_REACT); lap <= stops[j]; lap++) {
          if (sc[lap] && okStint(inp, next - lap)) { moved = lap; break; } // never break the per-set limit to catch a safety car
        }
        if (moved > 0) stops[j] = moved;
        const cheap = sc[stops[j]] === 1;
        usedSC ||= cheap;
        pit += cheap ? inp.pitLossSC : inp.pitLoss;
      }
      const t = raceTime(cost, s.seq, stops, L) + pit;
      times[i][k] = t;
      if (usedSC) scStops[i]++;
      if (t < times[bestI][k]) bestI = i;
    });
    wins[bestI]++;
  }

  const q = (a: Float64Array, f: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
  const res = strats.map((s, i) => ({
    ...s, mean: times[i].reduce((x, y) => x + y, 0) / n, p10: q(times[i], 0.1), p90: q(times[i], 0.9),
    winPct: (wins[i] / n) * 100, scStopPct: (scStops[i] / n) * 100, window: pitWindows(inp, s),
  }));
  const base = Math.min(...res.map((r) => r.mean));
  return res.map((r) => ({ ...r, mean: r.mean - base, p10: r.p10 - base, p90: r.p90 - base })).sort((a, b) => a.mean - b.mean);
}

export const strategyName = (s: Pick<Strategy, "seq">) => s.seq.map((c) => c[0] + c.slice(1).toLowerCase()).join(" → ");
