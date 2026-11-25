// Race strategy maths (pure, unit-tested in strategy.test.ts). All numbers are estimates from public timing data.
import type { Lap } from "./openf1";

export type StratIn = {
  n: number; code: string; position: number;
  gap: number | null; // seconds behind the leader (leader = 0); null = lapped / unknown
  compound: string | null; age: number | null; out?: boolean;
};
export type Rejoin = { position: number; ahead: { code: string; gap: number } | null; behind: { code: string; gap: number } | null };
export type StratRow = {
  n: number; code: string; position: number; compound: string | null; age: number | null;
  rejoin: Rejoin | null;
  tyreLoss: number | null; // seconds per lap slower than on new tyres of the same compound
  payback: number | null; // laps on fresh tyres needed to win back the pit-stop time
  windowOpen: boolean; // a stop now would pay back before the flag
};
export type Threat = { kind: "undercut" | "overcut"; attacker: string; defender: string; interval: number; gain: number };

// typical degradation (s/lap per lap of tyre age) used until this session has enough clean laps of its own
export const DEFAULT_DEG: Record<string, number> = { SOFT: 0.08, MEDIUM: 0.05, HARD: 0.03, INTERMEDIATE: 0.06, WET: 0.04 };
const OUT_LAP_COST = 0.6; // seconds the pitting car loses warming fresh tyres on its out-lap

export function strategy(rows: StratIn[], o: { pitLoss: number; deg: Record<string, number>; lapsLeft: number | null }) {
  const running = rows.filter((r) => !r.out).sort((a, b) => a.position - b.position);
  const timed = running.filter((r) => r.gap != null);
  const loss = (r: StratIn) => (r.compound && r.age != null ? Math.max(0, (o.deg[r.compound] ?? DEFAULT_DEG[r.compound] ?? 0.05) * r.age) : null);

  const out: StratRow[] = running.map((r) => {
    let rejoin: Rejoin | null = null;
    if (r.gap != null) {
      const at = r.gap + o.pitLoss, others = timed.filter((x) => x.n !== r.n);
      const ahead = others.filter((x) => x.gap! < at).sort((a, b) => b.gap! - a.gap!)[0];
      const behind = others.filter((x) => x.gap! >= at).sort((a, b) => a.gap! - b.gap!)[0];
      rejoin = {
        position: 1 + others.filter((x) => x.gap! < at).length,
        ahead: ahead ? { code: ahead.code, gap: at - ahead.gap! } : null,
        behind: behind ? { code: behind.code, gap: behind.gap! - at } : null,
      };
    }
    const tl = loss(r);
    const payback = tl && tl > 0.01 ? o.pitLoss / tl : null;
    return {
      n: r.n, code: r.code, position: r.position, compound: r.compound, age: r.age, rejoin, tyreLoss: tl, payback,
      windowOpen: payback != null && o.lapsLeft != null && payback <= o.lapsLeft,
    };
  });

  // attacker = car behind. Undercut: it pits first and gains the defender's tyre deficit for ~2 laps before the defender reacts.
  const threats: Threat[] = [];
  for (let i = 1; i < timed.length; i++) {
    const a = timed[i - 1], b = timed[i], interval = b.gap! - a.gap!;
    const la = loss(a);
    if (la == null || interval <= 0) continue;
    const gain = 2 * la - OUT_LAP_COST;
    if (gain > 0.3 && interval < gain) threats.push({ kind: "undercut", attacker: b.code, defender: a.code, interval, gain });
    // overcut only mid-stint: right after stops everyone's tyres are "barely worn" and the hint means nothing
    else if (la < 0.4 && (a.age ?? 0) >= 8 && interval < 1.5) threats.push({ kind: "overcut", attacker: b.code, defender: a.code, interval, gain: OUT_LAP_COST - la });
  }
  return { rows: out, threats };
}

/** Race distance → laps: the smallest number of laps that covers it (F1 rule). */
export const raceLaps = (lapLengthM: number, distanceKm: number) => (lapLengthM > 0 ? Math.ceil((distanceKm * 1000) / lapLengthM) : null);

/**
 * Gap between two drivers at the end of each lap they both completed: seconds B crossed the line after A
 * (positive = B behind). Only laps finished before time t (epoch ms) count.
 */
export function battleGaps(laps: Lap[], a: number, b: number, t = Infinity): { lap: number; gap: number }[] {
  const ends = (n: number) => new Map(
    laps.filter((l) => l.driver_number === n && l.date_start && l.lap_duration)
      .map((l) => [l.lap_number, Date.parse(l.date_start!) + l.lap_duration! * 1000] as const)
      .filter(([, end]) => end <= t),
  );
  const ea = ends(a), eb = ends(b);
  return [...ea].filter(([lap]) => eb.has(lap)).map(([lap, end]) => ({ lap, gap: (eb.get(lap)! - end) / 1000 })).sort((x, y) => x.lap - y.lap);
}

/** Seconds per lap the gap is changing over the last `over` laps (negative = closing). */
export function trend(gaps: { gap: number }[], over = 3): number | null {
  if (gaps.length < 2) return null;
  const s = gaps.slice(-over - 1);
  return (s.at(-1)!.gap - s[0].gap) / (s.length - 1);
}
