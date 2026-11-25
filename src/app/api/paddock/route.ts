import { NextResponse, type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { getLogbook } from "@/lib/fia";

/** GET /api/paddock?event=<fia event id> → parsed penalties, PU usage, parc fermé changes, documents. */
export async function GET(req: NextRequest) {
  const event = req.nextUrl.searchParams.get("event") ?? undefined;
  if (event && !/^\d{1,7}$/.test(event)) return bad("event must be an FIA event id");
  try {
    return NextResponse.json(await getLogbook(event), { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (e) {
    return fail(e);
  }
}
