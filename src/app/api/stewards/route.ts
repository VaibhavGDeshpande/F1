import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { latestStewardsDocs } from "@/lib/fia";

/** GET /api/stewards → latest event's stewards' decisions + summons (titles and PDF paths), newest first. */
export async function GET() {
  try {
    return NextResponse.json(await latestStewardsDocs(), { headers: { "Cache-Control": "public, s-maxage=60" } });
  } catch (e) {
    return fail(e);
  }
}
