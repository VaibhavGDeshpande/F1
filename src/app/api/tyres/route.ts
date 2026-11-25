import { NextResponse, type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { SAFE_SESSION } from "@/lib/openf1";
import { tyreDegradation } from "@/lib/session";

/** GET /api/tyres?session_key= → tyre degradation per stint and per compound. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("session_key") ?? "";
  if (!SAFE_SESSION.test(key)) return bad("session_key must be a number or 'latest'");
  try {
    const d = await tyreDegradation(key);
    return d ? NextResponse.json(d) : NextResponse.json({ error: "Session not found" }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}
