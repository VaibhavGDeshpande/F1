import { NextResponse, type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { SAFE_SESSION } from "@/lib/openf1";
import { lapTelemetry } from "@/lib/session";

/** GET /api/telemetry?session_key=&driver=&lap= → car data with distance + location path for one lap. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get("session_key") ?? "", driver = sp.get("driver") ?? "", lap = sp.get("lap") ?? "";
  if (!SAFE_SESSION.test(key) || !/^\d{1,2}$/.test(driver) || !/^\d{1,3}$/.test(lap)) return bad("need session_key, driver and lap");
  try {
    const t = await lapTelemetry(key, Number(driver), Number(lap));
    return t ? NextResponse.json(t) : NextResponse.json({ error: "Lap not found or not timed" }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}
