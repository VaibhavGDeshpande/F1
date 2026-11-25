import { NextResponse, type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { neutralisedLaps, stintDegradation } from "@/lib/analysis";
import { cacheFor, getSession, openf1, SAFE_SESSION, type Lap, type Pit, type RaceControl, type Stint } from "@/lib/openf1";
import { gapsToLeader, pitStops } from "@/lib/race-board";

/** GET /api/race-board?session_key=&t=<ISO, optional> → gap to leader per lap, current-stint tyre wear, pit stops (all as of t). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get("session_key") ?? "", t = sp.get("t");
  if (!SAFE_SESSION.test(key)) return bad("need session_key");
  if (t && Number.isNaN(Date.parse(t))) return bad("bad t");
  try {
    const session = await getSession(key);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const sk = session.session_key, c = cacheFor(session, 10), until = t ? Date.parse(t) : Infinity;
    const [allLaps, allStints, pits, rc] = await Promise.all([
      openf1<Lap>("laps", { session_key: sk }, c), openf1<Stint>("stints", { session_key: sk }, c),
      openf1<Pit>("pit", { session_key: sk }, c), openf1<RaceControl>("race_control", { session_key: sk }, c),
    ]);

    // the race as it stood at t: completed laps only, stints cut at each driver's last completed lap
    const laps = allLaps.filter((l) => l.date_start && l.lap_duration && Date.parse(l.date_start) + l.lap_duration * 1000 <= until);
    const last = new Map<number, number>();
    for (const l of laps) last.set(l.driver_number, Math.max(last.get(l.driver_number) ?? 0, l.lap_number));
    const stints = allStints
      .filter((s) => s.lap_start <= (last.get(s.driver_number) ?? 0))
      .map((s) => ({ ...s, lap_end: Math.min(s.lap_end, last.get(s.driver_number)!) }));

    const current = new Map<number, Stint>();
    for (const s of stints) if (s.stint_number > (current.get(s.driver_number)?.stint_number ?? 0)) current.set(s.driver_number, s);
    const fits = stintDegradation(laps, stints, neutralisedLaps(rc.filter((m) => Date.parse(m.date) <= until)), 3);
    const tyres = [...current.values()].map((s) => {
      const fit = fits.find((d) => d.driver_number === s.driver_number && d.stint_number === s.stint_number);
      return {
        driver_number: s.driver_number, compound: s.compound, stint: s.stint_number,
        age: (s.tyre_age_at_start ?? 0) + (s.lap_end - s.lap_start + 1),
        slope: fit?.slope ?? null, pace: fit?.pace ?? null, laps: fit?.laps ?? 0,
      };
    });

    return NextResponse.json({ gaps: gapsToLeader(laps), tyres, pits: pitStops(pits, allStints, until) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
