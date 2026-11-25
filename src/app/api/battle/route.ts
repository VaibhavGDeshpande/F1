import { NextResponse, type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { cacheFor, getSession, openf1, SAFE_SESSION, type Lap } from "@/lib/openf1";
import { battleGaps } from "@/lib/strategy";

/** GET /api/battle?session_key=&a=<driver ahead>&b=<driver behind>&t=<ISO, optional> → gap per completed lap. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get("session_key") ?? "", a = sp.get("a") ?? "", b = sp.get("b") ?? "", t = sp.get("t");
  if (!SAFE_SESSION.test(key) || !/^\d{1,2}$/.test(a) || !/^\d{1,2}$/.test(b)) return bad("need session_key, a and b");
  if (t && Number.isNaN(Date.parse(t))) return bad("bad t");
  try {
    const session = await getSession(key);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const laps = await openf1<Lap>("laps", { session_key: session.session_key }, cacheFor(session, 10));
    return NextResponse.json(battleGaps(laps, Number(a), Number(b), t ? Date.parse(t) : Infinity), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
