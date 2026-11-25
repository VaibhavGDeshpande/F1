// Team logos, car renders and driver portraits from formula1.com's image CDN (hotlinked, current season only).
// Pure helpers: safe to import from client and server components.
const CDN = "https://media.formula1.com/image/upload";
const V = "v1740000001/common/f1";

// order matters: "Racing Bulls" / "RB F1 Team" must not fall through to Red Bull
const SLUGS: [RegExp, string][] = [
  [/racing bulls|^rb\b|visa|alphatauri|toro rosso/i, "racingbulls"],
  [/red ?_?bull/i, "redbullracing"],
  [/aston/i, "astonmartin"],
  [/haas/i, "haasf1team"],
  [/audi|sauber/i, "audi"],
  [/mclaren/i, "mclaren"],
  [/mercedes/i, "mercedes"],
  [/ferrari/i, "ferrari"],
  [/williams/i, "williams"],
  [/alpine/i, "alpine"],
  [/cadillac/i, "cadillac"],
];

/** Team name or Jolpica constructorId → formula1.com team slug. */
export const teamSlug = (name?: string | null) => (name ? (SLUGS.find(([re]) => re.test(name))?.[1] ?? null) : null);

// shortcut: assumes formula1.com keeps its common/f1/<year>/<team>/ image layout; check once the next season's images exist.
const year = () => new Date().getUTCFullYear();

export function teamLogo(team?: string | null, h = 48) {
  const s = teamSlug(team), y = year();
  return s ? `${CDN}/c_lfill,h_${h}/q_auto/${V}/${y}/${s}/${y}${s}logowhite.webp` : null;
}

export function teamCar(team?: string | null, h = 224) {
  const s = teamSlug(team), y = year();
  return s ? `${CDN}/c_lfill,h_${h}/q_auto/d_common:f1:${y}:fallback:car:${y}fallbackcarright.webp/${V}/${y}/${s}/${y}${s}carright.webp` : null;
}

const letters = (x: string) => x.normalize("NFD").replace(/[^a-zA-Z]/g, "").toLowerCase();

/** formula1.com driver reference: first 3 letters of first name + first 3 of surname + "01" (e.g. Oliver Bearman → olibea01). */
export const driverRef = (given: string, family: string) => letters(given.split(" ")[0]).slice(0, 3) + letters(family).slice(0, 3) + "01";

/** The reference embedded in an OpenF1 headshot URL (…/LANNOR01_Lando_Norris/…), if any. */
export const refFromHeadshot = (url?: string | null) => url?.match(/\/([A-Z]{6}\d{2})_/)?.[1].toLowerCase() ?? null;

export function driverPortrait(team: string | null | undefined, ref: string | null, w = 440) {
  const s = teamSlug(team), y = year();
  return s && ref ? `${CDN}/c_lfill,w_${w}/q_auto/d_common:f1:${y}:fallback:driver:${y}fallbackdriverright.webp/${V}/${y}/${s}/${ref}/${y}${s}${ref}right.webp` : null;
}
