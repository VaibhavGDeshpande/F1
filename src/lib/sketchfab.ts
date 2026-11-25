// Community 3D car models from Sketchfab's public search API, shown in Sketchfab's own embed player (credits kept).
import { teamSlug } from "./media.ts"; // explicit extension so the unit test can load it under plain node

export type CarModel = {
  uid: string; name: string; year: number | null; author: string; authorUrl: string; viewerUrl: string; embedUrl: string;
  thumb: string | null; likes: number; license: string | null;
};
type Hit = {
  uid: string; name: string; likeCount: number; viewerUrl: string; embedUrl: string; tags?: { name: string }[];
  user?: { displayName: string; profileUrl: string }; license?: { label: string } | null;
  thumbnails?: { images: { url: string; width: number }[] };
};

// what people call each team when they upload models
const SEARCH: Record<string, string> = {
  redbullracing: "red bull", racingbulls: "racing bulls vcarb", haasf1team: "haas", astonmartin: "aston martin",
};
// not a car, or not a real team car
const NOT_A_CAR = /helmet|concept|idea|low ?poly|all team|suit|steering|wheel|engine|logo|livery design|driver|figure|keychain|toy|lego/i;

export const yearOf = (h: Pick<Hit, "name" | "tags">) => {
  const m = `${h.name} ${(h.tags ?? []).map((t) => t.name).join(" ")}`.match(/\b(20[1-3]\d)\b/);
  return m ? Number(m[1]) : null;
};

// must look like an F1 car: "F1"/"Formula 1" or a chassis code (W17, RB22, SF-26, MCL40, AMR26, FW48, VF-26, A526, R26, MAC-26, VCARB)
const F1_SIGNAL = /\bf1\b|formula ?(1|one)|grand prix|\b(w\d{2}|rb-?\d{2}|sf-?\d{2}|mcl\d{2}|amr-?\d{2}|fw\d{2}|vf-?\d{2}|a5\d{2}|r\d{2}|mac-?\d{2}|vcarb)\b/i;
const ROAD_CAR = /sedan|saloon|\bamg\b|\bgt\d*\b|suv|hypercar|coupe|road car|\bev\b/i;

/** Is this search hit an F1 car of `slug`'s team from `year`? (pure, unit-tested) */
export const isTeamCar = (h: Pick<Hit, "name" | "tags">, slug: string, year: number) => {
  const text = `${h.name} ${(h.tags ?? []).map((t) => t.name).join(" ")}`;
  return teamSlug(h.name) === slug && yearOf(h) === year && !NOT_A_CAR.test(h.name) && !ROAD_CAR.test(h.name) && F1_SIGNAL.test(text);
};

async function search(q: string): Promise<Hit[]> {
  const res = await fetch(`https://api.sketchfab.com/v3/search?type=models&count=24&q=${encodeURIComponent(q)}`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Sketchfab search ${res.status}`);
  return (await res.json()).results ?? [];
}

// Real thumbnails live under /models/<uid>/; a model still processing gets Sketchfab's shared grey placeholder instead.
export const realThumb = (h: Pick<Hit, "uid" | "thumbnails">) =>
  [...(h.thumbnails?.images ?? [])].filter((i) => i.url.includes(`/models/${h.uid}/`))
    .sort((a, b) => Math.abs(a.width - 640) - Math.abs(b.width - 640))[0]?.url ?? null;

const toModel = (h: Hit): CarModel => ({
  uid: h.uid, name: h.name, year: yearOf(h), author: h.user?.displayName ?? "unknown", authorUrl: h.user?.profileUrl ?? h.viewerUrl,
  viewerUrl: h.viewerUrl, embedUrl: h.embedUrl, likes: h.likeCount, license: h.license?.label ?? null, thumb: realThumb(h),
});

/** Best-liked models of a team's car for `year`; falls back to the newest earlier year that has one. */
export async function teamModels(team: string, year: number): Promise<{ models: CarModel[]; year: number | null }> {
  const slug = teamSlug(team);
  if (!slug) return { models: [], year: null };
  const term = SEARCH[slug] ?? team;
  for (const y of [year, year - 1, year - 2]) {
    const hits = (await Promise.all([search(`${term} f1 ${y}`), search(`${term} ${y}`)])).flat();
    const seen = new Set<string>();
    // models with a real picture first, then most liked
    const cars = hits.filter((h) => isTeamCar(h, slug, y) && !seen.has(h.uid) && seen.add(h.uid))
      .sort((a, b) => Number(!!realThumb(b)) - Number(!!realThumb(a)) || b.likeCount - a.likeCount);
    if (cars.length) return { models: cars.slice(0, 4).map(toModel), year: y };
  }
  return { models: [], year: null };
}
