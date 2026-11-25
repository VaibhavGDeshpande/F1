// Dashboard layout: keep panels from overlapping (pure, unit-tested in layout.test.ts).
export type Rect = { id: string; x: number; y: number; w: number; h: number };

export const GAP = 10;
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The panel `activeId` stays exactly where it is; every other panel that would overlap it (or a panel pushed before it)
 * moves straight down until it's clear. Panels are processed top to bottom, so pushes cascade like a stack.
 */
export function pushApart<T extends Rect>(rects: T[], activeId: string): T[] {
  const active = rects.find((r) => r.id === activeId);
  if (!active) return rects;
  const placed: Rect[] = [active];
  const moved = new Map<string, T>([[active.id, active]]);
  for (const r of rects.filter((x) => x.id !== activeId).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const c = { ...r };
    for (let hit = placed.find((p) => overlaps(c, p)); hit; hit = placed.find((p) => overlaps(c, p))) c.y = hit.y + hit.h + GAP;
    placed.push(c);
    moved.set(c.id, c);
  }
  return rects.map((r) => moved.get(r.id)!);
}
