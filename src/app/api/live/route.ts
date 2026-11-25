import { NextResponse, type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { liveState } from "@/lib/live";
import { SAFE_SESSION } from "@/lib/openf1";

/**
 * GET /api/live?session_key=<key|latest>&t=<ISO, omit for live>&driver=<number for telemetry>
 * Timing tower, car positions, race control, radio, weather and track status at instant t.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get("session_key") ?? "latest", t = sp.get("t"), driver = sp.get("driver");
  if (!SAFE_SESSION.test(key)) return bad("bad session_key");
  if (t && Number.isNaN(Date.parse(t))) return bad("bad t");
  if (driver && !/^\d{1,2}$/.test(driver)) return bad("bad driver");
  try {
    return NextResponse.json(await liveState(key, t ?? undefined, driver ? Number(driver) : undefined), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
