// Which toasts to show between two live/replay updates (pure, unit-tested in live-events.test.ts).
import type { RaceControl } from "./openf1";

export type Tone = "red" | "amber" | "purple" | "info";
export type LiveEvent = { id: string; title: string; body: string; tone: Tone };
type Row = { driver_number: number; acronym: string; bestLap: number | null; pits: number; out: boolean; compound: string | null };
export type Snap = { t: number; status: string; race: boolean; raceControl: RaceControl[]; tower: Row[] };

const STEWARDS = /PENALTY|INVESTIGATION|NOTED|REPRIMAND|DISQUALIF|BLACK AND WHITE|STEWARDS/;
const STATUS_TOAST: Record<string, { title: string; tone: Tone }> = {
  "SAFETY CAR": { title: "Safety car deployed", tone: "amber" },
  VSC: { title: "Virtual safety car", tone: "amber" },
  "RED FLAG": { title: "Red flag — session stopped", tone: "red" },
  "SC ENDING": { title: "Safety car in this lap", tone: "amber" },
  CHEQUERED: { title: "Chequered flag", tone: "info" },
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}`;

export function liveEvents(prev: Snap | null, cur: Snap): LiveEvent[] {
  // first update, rewind or a scrub jump: don't replay a flood of old events
  if (!prev || cur.t <= prev.t || cur.t - prev.t > 120_000) return [];
  const out: LiveEvent[] = [];

  for (const m of [...cur.raceControl].reverse()) {
    const at = Date.parse(m.date);
    if (at > prev.t && at <= cur.t && STEWARDS.test(m.message)) {
      out.push({ id: `rc|${m.date}|${m.message}`, tone: /PENALTY|DISQUALIF|BLACK AND WHITE/.test(m.message) ? "red" : "amber",
        title: `Race control${m.lap_number ? ` · Lap ${m.lap_number}` : ""}`, body: m.message });
    }
  }

  const st = STATUS_TOAST[cur.status];
  if (st && cur.status !== prev.status) out.push({ id: `status|${cur.status}|${cur.t}`, title: st.title, tone: st.tone, body: "Track status changed." });
  if (cur.status === "GREEN" && ["SAFETY CAR", "VSC", "SC ENDING", "RED FLAG"].includes(prev.status)) {
    out.push({ id: `status|GREEN|${cur.t}`, title: "Green flag", tone: "info", body: "Racing resumes." });
  }

  const best = (s: Snap) => Math.min(...s.tower.map((r) => r.bestLap ?? Infinity));
  const before = best(prev), now = best(cur);
  if (Number.isFinite(before) && now < before - 1e-6) {
    const who = cur.tower.find((r) => r.bestLap === now);
    out.push({ id: `fl|${now}`, tone: "purple", title: "Fastest lap", body: `${who?.acronym ?? "?"} ${fmt(now)}` });
  }

  const pits: LiveEvent[] = [];
  for (const r of cur.tower) {
    const p = prev.tower.find((x) => x.driver_number === r.driver_number);
    if (!p) continue;
    if (cur.race && r.pits > p.pits) pits.push({ id: `pit|${r.driver_number}|${r.pits}`, tone: "info", title: "Pit stop", body: `${r.acronym} pits (stop ${r.pits})${r.compound ? ` — now on ${r.compound.toLowerCase()}` : ""}` });
    if (r.out && !p.out) out.push({ id: `out|${r.driver_number}`, tone: "red", title: "Retirement", body: `${r.acronym} has stopped / retired` });
  }
  // a safety car can send half the field in at once: one toast instead of a flood that pushes the rest off screen
  if (pits.length >= 3) out.push({ id: `pits|${cur.t}`, tone: "info", title: `${pits.length} pit stops`, body: pits.map((e) => e.body.split(" ")[0]).join(", ") + " pitted" });
  else out.push(...pits);
  return out;
}
