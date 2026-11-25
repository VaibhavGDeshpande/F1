// OpenF1 client (https://openf1.org). Historical data is free; data during a live session needs a paid account.
const BASE = "https://api.openf1.org/v1";

export type Session = {
  session_key: number; session_type: string; session_name: string; date_start: string; date_end: string;
  meeting_key: number; circuit_key: number; circuit_short_name: string; country_name: string; location: string; year: number; is_cancelled?: boolean;
};
export type Meeting = {
  meeting_key: number; meeting_name: string; meeting_official_name: string; location: string; country_name: string;
  circuit_key: number; circuit_short_name: string; circuit_type?: string; date_start: string; year: number;
};
export type Driver = {
  driver_number: number; name_acronym: string; full_name: string; broadcast_name: string;
  team_name: string; team_colour: string | null; headshot_url: string | null;
};
export type Lap = {
  driver_number: number; lap_number: number; date_start: string | null; lap_duration: number | null;
  duration_sector_1: number | null; duration_sector_2: number | null; duration_sector_3: number | null;
  is_pit_out_lap: boolean; st_speed: number | null;
};
export type Stint = { driver_number: number; stint_number: number; lap_start: number; lap_end: number; compound: string | null; tyre_age_at_start: number | null };
export type Position = { date: string; driver_number: number; position: number };
export type Interval = { date: string; driver_number: number; gap_to_leader: number | string | null; interval: number | string | null };
export type RaceControl = {
  date: string; driver_number: number | null; lap_number: number | null; category: string;
  flag: string | null; scope: string | null; sector: number | null; message: string;
};
export type TeamRadio = { date: string; driver_number: number; recording_url: string };
export type Weather = {
  date: string; air_temperature: number; track_temperature: number; humidity: number;
  rainfall: number; wind_speed: number; wind_direction: number;
};
export type Location = { date: string; driver_number: number; x: number; y: number; z: number };
export type CarData = { date: string; driver_number: number; speed: number; throttle: number; brake: number; n_gear: number; rpm: number };
export type Pit = { date: string; driver_number: number; lap_number: number; pit_duration: number | null; stop_duration?: number | null };

export class OpenF1Error extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let token: { value: string; expires: number } | null = null;

async function authHeader(): Promise<Record<string, string>> {
  const username = process.env.OPENF1_USERNAME, password = process.env.OPENF1_PASSWORD;
  if (!username || !password) return {};
  if (!token || Date.now() > token.expires) {
    const res = await fetch("https://api.openf1.org/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
      cache: "no-store",
    });
    if (!res.ok) throw new OpenF1Error(res.status, `OpenF1 login failed (${res.status})`);
    const j = await res.json();
    token = { value: j.access_token, expires: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000 };
  }
  return { Authorization: `Bearer ${token.value}` };
}

// OpenF1 free tier: 3 requests/second AND 30 requests/minute. Every request goes through this budget, and repeat
// queries are served from memory. When the budget is spent, stale data is served instead of waiting.
// shortcut: budget + cache are per server process; several instances can still exceed it (the 429 retry covers it).
// We skip Next's fetch cache on purpose: its hits are invisible to us and would still spend budget here.
// On globalThis because Next bundles each route separately; one shared budget per server process.
type Budget = { memo: Map<string, { until: number; data: Promise<unknown[]> }>; sent: number[]; blockedUntil: number };
const g = globalThis as unknown as { __openf1?: Budget };
const state: Budget = (g.__openf1 ??= { memo: new Map(), sent: [], blockedUntil: 0 });
const { memo, sent } = state;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function budgetWait(now: number) {
  const authed = !!process.env.OPENF1_USERNAME;
  const perSec = authed ? 6 : 3, perMin = Number(process.env.OPENF1_RPM) || (authed ? 60 : 28);
  while (sent.length && now - sent[0] > 60_000) sent.shift();
  const lastSec = sent.filter((t) => now - t < 1000);
  let wait = state.blockedUntil - now;
  if (lastSec.length >= perSec) wait = Math.max(wait, lastSec[lastSec.length - perSec] + 1000 - now);
  if (sent.length >= perMin) wait = Math.max(wait, sent[sent.length - perMin] + 60_000 - now);
  return wait;
}

async function slot() {
  for (;;) {
    const now = Date.now(), wait = budgetWait(now);
    if (wait <= 0) return void sent.push(now);
    await sleep(wait + 25);
  }
}

async function request(url: string, endpoint: string): Promise<unknown[]> {
  const headers = await authHeader();
  for (let attempt = 0; ; attempt++) {
    await slot();
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.status === 404) return []; // OpenF1 answers "No results found." with 404
    const body = await res.json().catch(() => null);
    const detail = String(body?.detail ?? body?.error ?? "");
    if ((res.status === 429 || /rate limit/i.test(detail)) && attempt < 4) {
      // pause every caller, not just this one: longer for the per-minute limit
      state.blockedUntil = Date.now() + (/minute/i.test(detail) ? 15_000 : 1_200);
      continue;
    }
    if (!res.ok || !Array.isArray(body)) {
      const msg = body?.detail ?? body?.error;
      throw new OpenF1Error(res.status, typeof msg === "string" ? msg : `OpenF1 error ${res.status} on ${endpoint}`);
    }
    return body;
  }
}

/**
 * Query an OpenF1 endpoint. Keys may carry an operator: { "date>": x } → date>x, { "date<=": x } → date<=x.
 * revalidate = seconds to cache (0 = always fresh).
 */
export async function openf1<T>(endpoint: string, params: Record<string, string | number | undefined>, revalidate = 3600): Promise<T[]> {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const [, name, op = "="] = k.match(/^(.*?)([<>]=?)?$/)!;
      return name + op.replace(/[<>]/g, encodeURIComponent) + encodeURIComponent(String(v));
    })
    .join("&");
  const url = `${BASE}/${endpoint}?${qs}`;
  if (revalidate <= 0) return (await request(url, endpoint)) as T[];
  const hit = memo.get(url), now = Date.now();
  if (hit && (hit.until > now || budgetWait(now) > 0)) return (await hit.data) as T[];
  if (memo.size > 400) for (const k of [...memo.keys()].slice(0, 100)) memo.delete(k);
  // a failed refresh falls back to the stale copy; a failed first load is not cached
  const data = request(url, endpoint).catch((e) => (hit ? hit.data : Promise.reject(e)));
  memo.set(url, { until: Date.now() + revalidate * 1000, data });
  data.catch(() => memo.delete(url));
  // OpenF1 sometimes answers "no results" while rate-limiting: keep empty answers for 15 s only, not the full TTL
  data.then((rows) => {
    const e = memo.get(url);
    if (!rows.length && e?.data === data) e.until = Math.min(e.until, Date.now() + 15_000);
  }, () => {});
  return (await data) as T[];
}

/** Sessions of a finished weekend never change, so cache them for a day. */
export const isFinished = (s: Pick<Session, "date_end">) => Date.now() > Date.parse(s.date_end) + 2 * 3600_000;
export const cacheFor = (s: Pick<Session, "date_end">, liveSeconds: number) => (isFinished(s) ? 86400 : liveSeconds);

export async function getSession(sessionKey: string | number) {
  const [s] = await openf1<Session>("sessions", { session_key: sessionKey }, 300);
  return s ?? null;
}

export const SAFE_SESSION = /^(\d{1,6}|latest)$/;

export const teamColour = (d?: Pick<Driver, "team_colour"> | null) => `#${d?.team_colour || "888888"}`;

export const COMPOUND_COLOURS: Record<string, string> = {
  SOFT: "#e8002d", MEDIUM: "#ffd12e", HARD: "#f0f0ec", INTERMEDIATE: "#43b02a", WET: "#0067ad",
};
export const compoundColour = (c: string | null | undefined) => COMPOUND_COLOURS[c ?? ""] ?? "#777";
