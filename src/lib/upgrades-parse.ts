// Parser for the FIA "Car Presentation Submissions" PDF: every component each team updated at an event (pure, see upgrades-parse.test.ts).
// Each team gets a page with a 4-column table (component · primary reason · geometric change · how it works), followed by
// image pages; text extraction loses the columns, so cells are rebuilt from the x/y position of each text item.

export type PdfItem = { x: number; y: number; w: number; str: string };
export type Upgrade = { component: string; reason: string; change: string; description: string };
/** pages: 1-based PDF pages of this team's table plus the FIA car drawings after it (red marks show where the parts are) */
export type TeamUpgrades = { team: string; noUpdates: boolean; updates: Upgrade[]; pages: number[] };

const HEADERS = [/^updated/i, /^primary reason/i, /^geometric/i, /^brief description/i];
const FALLBACK_COLS = [113, 185, 295, 535]; // header x positions seen in 2026 documents

/** Join items into readable text: top-to-bottom lines, left-to-right, glueing fragments that touch ("Las V" + "egas"). */
function join(items: PdfItem[]): string {
  const lines: PdfItem[][] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((l) => Math.abs(l[0].y - it.y) < 3);
    if (line) line.push(it); else lines.push([it]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x).reduce((s, it, i) => {
    if (!i) return it.str.trim();
    const prev = l[i - 1];
    return s + (it.x - (prev.x + prev.w) < 1.5 ? "" : " ") + it.str.trim();
  }, "")).join(" ").replace(/\s+/g, " ").replace(/\s+[–-]$/, "").replace(/^[–-]\s+/, "").trim(); // a dash can land in the neighbouring column
}

/** One page of the document → its team table, or null for cover and image pages. */
function parsePage(items: PdfItem[]): Omit<TeamUpgrades, "pages"> | null {
  const text = items.filter((i) => i.str.trim() && i.y > 45); // y ≤ 45: page footers (Williams: team name, page number, ©)
  // team pages are titled "Car Presentation – <event>"; the cover says "Car Presentation Submissions"
  const title = text.find((i) => /^car presentation\s*([–-].*)?$/i.test(i.str.trim()));
  if (!title) return null;
  const team = join(text.filter((i) => i.y < title.y - 8 && i.y > title.y - 34));
  if (!team) return null;
  const all = join(text);
  if (/no updates?/i.test(all) && !text.some((i) => i.y > title.y - 80 && HEADERS[0].test(i.str.trim()))) return { team, noUpdates: true, updates: [] };

  // column edges = midpoints between header starts (fallback: positions seen in 2026)
  // the header sits just under the team name; body text can start with the same words ("Updated rear brake duct…")
  const head = text.filter((i) => i.y > title.y - 72 && i.y < title.y - 15); // 2026: title 490, header 437/423, first row ≤ 409
  const cols = HEADERS.map((re, k) => head.find((i) => re.test(i.str.trim()))?.x ?? FALLBACK_COLS[k]);
  const edges = [1, 2, 3].map((k) => (cols[k - 1] + cols[k]) / 2);
  const headerBottom = Math.min(...head.map((i) => i.y), title.y - 40);

  // some templates put the header lower than usual: drop exact header phrases too (but keep body text like "Updated rear…")
  const HEADER_TEXT = /^(updated( component)?|component|primary reason( for)?( update)?|for update|update|geometric differences.*|(previous )?version|brief description.*|\(?min 20.*|20, max.*)$/i;
  const body = text.filter((i) => i.y < headerBottom - 3 && !HEADER_TEXT.test(i.str.trim()));
  const nums = body.filter((i) => /^\d{1,2}$/.test(i.str.trim()) && i.x < cols[0] - 8).sort((a, b) => b.y - a.y);
  if (!nums.length) return { team, noUpdates: /no updates?/i.test(all), updates: [] };
  const rows = nums.map(() => [[], [], [], []] as PdfItem[][]);
  for (const it of body) {
    if (nums.includes(it)) continue;
    const r = nums.reduce((best, n, k) => (Math.abs(n.y - it.y) < Math.abs(nums[best].y - it.y) ? k : best), 0);
    const c = it.x < edges[0] ? 0 : it.x < edges[1] ? 1 : it.x < edges[2] ? 2 : 3;
    rows[r][c].push(it);
  }
  const updates = rows.map(([a, b, c, d]) => ({ component: join(a), reason: join(b), change: join(c), description: join(d) }));
  // merged cells (one reason or description spanning several rows) land on the row nearest their middle: share them with
  // the empty neighbours, nearest first
  for (const key of ["reason", "description"] as const) {
    updates.forEach((u, k) => {
      if (u[key]) return;
      for (let d = 1; d < updates.length; d++) {
        const v = updates[k - d]?.[key] || updates[k + d]?.[key];
        if (v) { u[key] = v; break; }
      }
    });
  }
  return { team, noUpdates: false, updates: updates.filter((u) => u.component || u.change) };
}

/** Whole document (pages of positioned text) → one entry per team, continuation pages merged into the team before. */
export function parseCarPresentation(pages: PdfItem[][]): TeamUpgrades[] {
  const out: TeamUpgrades[] = [];
  let last: TeamUpgrades | null = null;
  pages.forEach((p, i) => {
    const t = parsePage(p);
    if (!t) {
      // a page without a team title right after a team's table is that team's drawing page (text-free image)
      if (last && !p.some((it) => it.str.trim() && it.y > 45)) last.pages.push(i + 1);
      return;
    }
    const same = out.find((o) => o.team === t.team);
    if (same) { same.updates.push(...t.updates); same.noUpdates &&= t.noUpdates; same.pages.push(i + 1); last = same; }
    else { last = { ...t, pages: [i + 1] }; out.push(last); }
  });
  return out;
}

/** "Performance - Flow Conditioning" → { kind: "Performance", detail: "Flow Conditioning" }. */
export function splitReason(reason: string): { kind: string; detail: string } {
  const m = reason.match(/^(Performance|Circuit specific|Reliability|Cooling Range|Other)\s*-?\s*(.*)$/i);
  return m ? { kind: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), detail: m[2].trim() } : { kind: reason, detail: "" };
}
