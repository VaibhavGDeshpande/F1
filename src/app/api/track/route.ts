import { NextResponse, type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { circuitInfo, trackOutline } from "@/lib/live";
import { getSession, SAFE_SESSION } from "@/lib/openf1";
import { seasonSchedule } from "@/lib/jolpica";

/** GET /api/track?session_key= → circuit outline, corner numbers and the TV map rotation. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("session_key") ?? "";
  if (!SAFE_SESSION.test(key)) return bad("bad session_key");
  try {
    const session = await getSession(key);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const [outline, circuit, loc] = await Promise.all([
      trackOutline(key),
      circuitInfo(session).catch(() => ({ rotation: 0, corners: [] })),
      // circuit coordinates (for the weather map) from the calendar race of the same weekend
      seasonSchedule(session.year)
        .then((rs) => rs.find((r) => Math.abs(Date.parse(r.date) - Date.parse(session.date_start)) < 5 * 86400_000)?.Circuit.Location)
        .catch(() => undefined),
    ]);
    const coords = loc ? { lat: Number(loc.lat), lon: Number(loc.long) } : {};
    return NextResponse.json({ outline, ...circuit, ...coords }, { headers: outline.length ? { "Cache-Control": "public, s-maxage=3600" } : {} });
  } catch (e) {
    return fail(e);
  }
}
