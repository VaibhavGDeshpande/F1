import { type NextRequest } from "next/server";
import { bad, fail } from "@/lib/api";
import { fiaUrl } from "@/lib/fia";

/**
 * GET /api/fia-pdf?path=/system/files/decision-document/<name>.pdf → that FIA document, unchanged.
 * fia.com sends no CORS headers, so the in-browser drawing viewer loads PDFs through here. Only FIA decision documents.
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!/^\/system\/files\/decision-document\/[\w.%()\-]+\.pdf$/i.test(path)) return bad("not an FIA decision document");
  try {
    const res = await fetch(fiaUrl(path), { headers: { "User-Agent": "Mozilla/5.0 (compatible; f1-site)" }, cache: "no-store" });
    if (!res.ok) return bad(`FIA ${res.status}`);
    return new Response(res.body, {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    });
  } catch (e) {
    return fail(e);
  }
}
