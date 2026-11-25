import { NextResponse, type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { cacheFor, getSession, openf1, SAFE_SESSION, type Lap } from "@/lib/openf1";

/** GET /api/laps?session_key=&driver=&t=<ISO, optional> → one driver's timed laps completed by t (all if no t). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get("session_key") ?? "", driver = sp.get("driver") ?? "", t = sp.get("t");
  if (!SAFE_SESSION.test(key) || !/^\d{1,2}$/.test(driver)) return bad("need session_key and driver");
  if (t && Number.isNaN(Date.parse(t))) return bad("bad t");
  try {
    const session = await getSession(key);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const laps = await openf1<Lap>("laps", { session_key: session.session_key }, cacheFor(session, 10));
    const until = t ? Date.parse(t) : Infinity;
    const out = laps
      .filter((l) => l.driver_number === Number(driver) && l.date_start && l.lap_duration && Date.parse(l.date_start) + l.lap_duration * 1000 <= until)
      .sort((a, b) => a.lap_number - b.lap_number)
      .map((l) => ({ lap: l.lap_number, time: l.lap_duration!, out: l.is_pit_out_lap || undefined }));
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
