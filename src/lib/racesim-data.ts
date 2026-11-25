// Starting values for the race simulator, from real data where it exists (every value can be changed on the page).
import { circuitInfo } from "./live";
import { openf1, type Meeting, type RaceControl, type Session } from "./openf1";
import { COMPOUNDS, type SimInput, type TyreModel } from "./racesim";
import { tyreDegradation } from "./session";
import { raceLaps } from "./strategy";

export const TYPICAL_TYRES: TyreModel = {
  SOFT: { pace: 0, deg: 0.08, life: 18 },
  MEDIUM: { pace: 0.35, deg: 0.05, life: 30 },
  HARD: { pace: 0.7, deg: 0.03, life: 42 },
};
export type SimDefaults = { input: SimInput; sources: { laps: string; pit: string; tyres: string; sc: string; maxStint: string } };

// Pirelli per-set lap limits announced for specific races ("year:circuit_key" → laps). Hand-maintained from news.
const STINT_LIMITS: Record<string, number> = { "2026:150": 27 }; // Qatar 2026 (formula1.com: "27-lap tyre limit for the Qatar GP")

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };

export async function simDefaults(m: Meeting): Promise<SimDefaults> {
  // race distance from the circuit length (MultiViewer may not have this season yet → last season)
  let circuit = await circuitInfo({ circuit_key: m.circuit_key, year: m.year }).catch(() => null);
  if (!circuit?.lapLength) circuit = await circuitInfo({ circuit_key: m.circuit_key, year: m.year - 1 }).catch(() => null);
  const distance = m.circuit_key === 22 ? 260 : 305; // Monaco is the one shorter race
  const laps = circuit?.lapLength ? raceLaps(circuit.lapLength, distance) : null;

  // finished races at this circuit, newest first (this season's too if it has run)
  const races: Session[] = [];
  for (const year of [m.year, m.year - 1, m.year - 2, m.year - 3]) {
    const s = (await openf1<Session>("sessions", { circuit_key: m.circuit_key, year, session_name: "Race" }, 3600).catch(() => []))
      .find((x) => !x.is_cancelled && Date.parse(x.date_end) < Date.now());
    if (s) races.push(s);
  }

  // safety car / VSC history from previous seasons (Laplace-smoothed so 0 of 2 doesn't mean "never")
  const past = races.filter((r) => r.year < m.year).slice(0, 3);
  let withSC = 0;
  for (const r of past) {
    const rc = await openf1<RaceControl>("race_control", { session_key: r.session_key }, 86400).catch(() => []);
    if (rc.some((x) => /SAFETY CAR DEPLOYED/i.test(x.message))) withSC++;
  }
  const scChance = past.length ? (withSC + 1) / (past.length + 2) : 0.5;

  // tyres: wear and usable life per compound from the latest race here (fuel-corrected). Pace gaps between compounds stay
  // typical: in race data they're swamped by track evolution and traffic (later, harder stints look faster than they are).
  const tyres: TyreModel = structuredClone(TYPICAL_TYRES);
  let tyreSource = "typical values (no previous race here)";
  const ref = races[0];
  const deg = ref ? await tyreDegradation(String(ref.session_key)).catch(() => null) : null;
  if (deg?.stints.length) {
    const measured: string[] = [];
    for (const c of COMPOUNDS) {
      const st = deg.stints.filter((s) => s.compound === c);
      if (!st.length) continue;
      const d = median(st.map((s) => s.slope));
      if (d >= 0.005) { tyres[c].deg = clamp(d, 0.005, 0.3); measured.push(c.toLowerCase()); } // negative = track evolution won
      tyres[c].life = Math.max(tyres[c].life, Math.max(...st.map((s) => s.points.at(-1)!.age))); // teams ran it this long
    }
    tyreSource = `wear${measured.length ? ` (${measured.join(", ")})` : ""} and tyre life from the ${ref.year} race here, ${deg.stints.length} stints; pace gaps typical`;
  }

  return {
    input: {
      laps: laps ?? 57,
      pitLoss: circuit?.pitLoss ?? 22,
      pitLossSC: circuit?.pitLossSC ?? (circuit?.pitLoss ?? 22) * 0.6,
      scChance, tyres,
      maxStint: STINT_LIMITS[`${m.year}:${m.circuit_key}`] ?? 0,
    },
    sources: {
      laps: laps ? `${distance} km ÷ ${(circuit!.lapLength! / 1000).toFixed(3)} km lap` : "typical (circuit length unavailable)",
      pit: circuit?.pitLoss ? "pit-lane time loss for this circuit (MultiViewer)" : "generic 22 s (no circuit figure)",
      tyres: tyreSource,
      sc: past.length ? `safety car or VSC in ${withSC} of the last ${past.length} races here` : "no race history here: 50/50",
      maxStint: STINT_LIMITS[`${m.year}:${m.circuit_key}`] ? "Pirelli's announced per-set limit for this race" : "no limit announced (0 = none)",
    },
  };
}
