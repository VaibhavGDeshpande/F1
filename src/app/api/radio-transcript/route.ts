import { NextResponse, type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { isRadioUrl, transcribe } from "@/lib/radio";

/** GET /api/radio-transcript?url=<OpenF1 team radio recording_url> → { text }. First call per clip takes ~10 s. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  if (!isRadioUrl(url)) return bad("url must be an F1 team radio recording");
  try {
    return NextResponse.json({ text: await transcribe(url) }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch (e) {
    return fail(e);
  }
}
