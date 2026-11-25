// Session weather forecasts from Open-Meteo (free, no key; forecasts reach 16 days ahead).
import type { Meeting, Session } from "./openf1";

export type Forecast = { temp: number; rainChance: number; rainMm: number; wind: number; windFrom: string; cloud: number };
type Hourly = {
  time: string[]; temperature_2m: number[]; precipitation_probability: number[]; precipitation: number[];
  wind_speed_10m: number[]; wind_direction_10m: number[]; cloud_cover: number[];
};

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Forecast over a session: mean temperature/wind/cloud, highest rain chance, total rain. Null if outside the forecast. */
export function summarise(h: Hourly, start: string, end: string): Forecast | null {
  const a = Math.floor(Date.parse(start) / 3600_000) * 3600_000, b = Date.parse(end);
  const idx = h.time.map((t, i) => [Date.parse(`${t}:00Z`), i] as const).filter(([t]) => t >= a && t < b).map(([, i]) => i);
  if (!idx.length) return null;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const pick = (k: keyof Omit<Hourly, "time">) => idx.map((i) => h[k][i]).filter((x) => x != null);
  return {
    temp: mean(pick("temperature_2m")), rainChance: Math.max(0, ...pick("precipitation_probability")),
    rainMm: pick("precipitation").reduce((s, x) => s + x, 0), wind: mean(pick("wind_speed_10m")),
    windFrom: compass(mean(pick("wind_direction_10m"))), cloud: mean(pick("cloud_cover")),
  };
}

/** Forecast per upcoming session of a weekend, keyed by session_key. Empty if the circuit or forecast isn't available. */
export async function sessionForecasts(m: Meeting, sessions: Session[]): Promise<Record<number, Forecast>> {
  const upcoming = sessions.filter((s) => Date.parse(s.date_end) > Date.now() && Date.parse(s.date_start) < Date.now() + 16 * 86400_000);
  if (!upcoming.length) return {};
  const { seasonSchedule } = await import("./jolpica"); // loaded here so the pure helpers above stay testable under plain node
  const race = (await seasonSchedule(m.year).catch(() => [])).find((r) => Math.abs(Date.parse(r.date) - Date.parse(m.date_start)) < 5 * 86400_000);
  if (!race) return {};
  const { lat, long } = race.Circuit.Location;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&timezone=UTC&forecast_days=16` +
    "&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover";
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) return {};
  const { hourly } = (await res.json()) as { hourly: Hourly };
  const out: Record<number, Forecast> = {};
  for (const s of upcoming) {
    const f = summarise(hourly, s.date_start, s.date_end);
    if (f) out[s.session_key] = f;
  }
  return out;
}
