// "Did it work?": each team's qualifying pace per round, to set beside its upgrade weekends (pure, see upgrade-pace.test.ts).

export type QualiRound = { round: number; race: string; rows: { team: string; times: (string | undefined)[] }[] };
export type PaceRound = { round: number; race: string; gap: Record<string, number> };

/** "1:18.518" → 78.518; missing or unparseable (no time set) → null. */
export function lapSeconds(t?: string): number | null {
  const m = t?.trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : null;
}

/** Per round, each team's best lap of the whole qualifying session as % slower than the fastest lap ("supertime" gap). */
export function qualiGaps(rounds: QualiRound[], slugOf: (team: string) => string | null): PaceRound[] {
  return rounds.map(({ round, race, rows }) => {
    const best: Record<string, number> = {};
    for (const r of rows) {
      const slug = slugOf(r.team);
      const t = Math.min(...r.times.map(lapSeconds).filter((x): x is number => x != null));
      if (slug && Number.isFinite(t) && !(best[slug] <= t)) best[slug] = t;
    }
    const top = Math.min(...Object.values(best));
    const gap = Object.fromEntries(Object.entries(best).map(([s, t]) => [s, Math.round(((t - top) / top) * 10000) / 100]));
    return { round, race, gap };
  }).filter((r) => Object.keys(r.gap).length);
}

/** Key that matches FIA event names to Jolpica race names ("Barcelona-Catalunya" ~ "Barcelona", "São Paulo" ~ "Brazilian"). */
export function raceKey(name: string): string {
  const w = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[\s-]+/)[0];
  return ({ sao: "brazilian" } as Record<string, string>)[w] ?? w;
}

/** Mean gap over up to n rounds before index i, and over i and the n-1 rounds after it (the upgrade weekend counts as "after"). */
export function beforeAfter(gaps: (number | undefined)[], i: number, n = 3): { before: number; after: number } | null {
  const mean = (xs: (number | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const before = mean(gaps.slice(Math.max(0, i - n), i)), after = mean(gaps.slice(i, i + n));
  return before == null || after == null ? null : { before, after };
}
