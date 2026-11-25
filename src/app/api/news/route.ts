import { NextResponse, type NextRequest } from "next/server";
import { getNews } from "@/lib/news";

/** GET /api/news?q=&source= → aggregated, de-duplicated headlines. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const news = await getNews({ q: sp.get("q")?.slice(0, 100) || undefined, source: sp.get("source") || undefined });
  return NextResponse.json(news, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
