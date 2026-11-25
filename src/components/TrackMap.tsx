// SVG circuit map with car markers and corner numbers. Pure (no hooks): animate it by re-rendering with new positions.
type P = { x: number; y: number };
type Corner = { n: number; letter?: string; x: number; y: number; angle: number; name?: string };

export function TrackMap({ outline, cars = [], segments, corners = [], rotation = 0, showNames = false, height = 360, transitionMs = 0 }: {
  outline: P[];
  cars?: (P & { label: string; colour: string; highlight?: boolean })[];
  segments?: { points: P[]; colour: string }[];
  corners?: Corner[];
  rotation?: number; // degrees, to match the TV broadcast orientation
  showNames?: boolean; // print corner names next to the numbers (big maps); small maps show them on hover only
  height?: number | string;
  transitionMs?: number; // CSS glide between positions; 0 when the caller animates every frame itself
}) {
  const base = outline.length ? outline : cars;
  if (!base.length) return <div className="muted grid place-items-center text-sm" style={{ height }}>Waiting for position data…</div>;

  // rotate everything about the outline's centre so the map faces the way it does on TV
  const cx = (Math.min(...base.map((p) => p.x)) + Math.max(...base.map((p) => p.x))) / 2;
  const cy = (Math.min(...base.map((p) => p.y)) + Math.max(...base.map((p) => p.y))) / 2;
  const a = (rotation * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const rot = <T extends P>(p: T): T => ({ ...p, x: cx + (p.x - cx) * cos - (p.y - cy) * sin, y: cy + (p.x - cx) * sin + (p.y - cy) * cos });

  const track = outline.map(rot);
  const all = track.length ? track : cars.map(rot);
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const size = Math.max(maxX - minX, maxY - minY) || 1000;
  const pad = size * 0.09;
  const w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
  // SVG y grows downward, track y grows upward
  const sx = (x: number) => x - minX + pad, sy = (y: number) => maxY - y + pad;
  const line = (ps: P[]) => ps.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(0)},${sy(p.y).toFixed(0)}`).join("");
  const r = size / 95;
  const start = track[0];
  const ordered = [...cars].sort((a, b) => Number(!!a.highlight) - Number(!!b.highlight)).map(rot); // highlighted car on top
  // corner label sits just off the track, in the direction MultiViewer gives for that corner
  const off = size * 0.035;
  const cornerLabels = corners.map((c, i) => {
    const t = (c.angle * Math.PI) / 180;
    const at = rot({ x: c.x + off * Math.cos(t), y: c.y + off * Math.sin(t) }), on = rot(c);
    return {
      ...at, on, label: `${c.n}${c.letter ?? ""}`, name: c.name,
      // print a name once per run of same-named corners (e.g. Becketts 12–13), on the first of them
      printName: showNames && !!c.name && c.name !== corners[i - 1]?.name,
      dx: at.x - on.x, // name goes on the side away from the track
    };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ height, width: "100%" }} role="img" aria-label="Track map with car positions">
      {track.length > 0 && (
        <>
          <path d={line(track)} fill="none" stroke="#1c1c1f" strokeWidth={r * 3.2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={line(track)} fill="none" stroke="#3f3f46" strokeWidth={r * 1.6} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {segments?.map((s, i) => <path key={i} d={line(s.points.map(rot))} fill="none" stroke={s.colour} strokeWidth={r * 1.4} strokeLinejoin="round" strokeLinecap="round" />)}
      {cornerLabels.map((c) => (
        <g key={c.label}>
          <title>{c.name ? `Turn ${c.label} · ${c.name}` : `Turn ${c.label}`}</title>
          <line x1={sx(c.on.x)} y1={sy(c.on.y)} x2={sx(c.x)} y2={sy(c.y)} stroke="#52525b" strokeWidth={r / 5} />
          <circle cx={sx(c.x)} cy={sy(c.y)} r={r * 1.05} fill="#18181b" stroke="#52525b" strokeWidth={r / 6} />
          <text x={sx(c.x)} y={sy(c.y)} dy="0.35em" textAnchor="middle" fontSize={r * 1.15} fill="#d4d4d8" fontWeight={600}>{c.label}</text>
          {c.printName && (
            <text x={sx(c.x) + (c.dx >= 0 ? r * 1.5 : -r * 1.5)} y={sy(c.y)} dy="0.35em" textAnchor={c.dx >= 0 ? "start" : "end"}
              fontSize={r * 1.05} fill="#a1a1aa" fontStyle="italic" stroke="#08080a" strokeWidth={r / 3} paintOrder="stroke">{c.name}</text>
          )}
        </g>
      ))}
      {start && (
        <g transform={`translate(${sx(start.x)} ${sy(start.y)})`}>
          <rect x={-r * 1.6} y={-r * 0.45} width={r * 3.2} height={r * 0.9} fill="#fafafa" rx={r * 0.2} />
          <text y={-r * 1.3} textAnchor="middle" fontSize={r * 1.5} fill="#a1a1aa">START</text>
        </g>
      )}
      {ordered.map((c) => (
        <g key={c.label} style={{ transform: `translate(${sx(c.x)}px, ${sy(c.y)}px)`, transition: transitionMs ? `transform ${transitionMs}ms linear` : undefined }}>
          {c.highlight && <circle r={r * 2.4} fill={c.colour} opacity={0.25} />}
          <circle r={c.highlight ? r * 1.35 : r} fill={c.colour} stroke={c.highlight ? "#fff" : "#09090b"} strokeWidth={r / 3} />
          <g transform={`translate(0 ${-r * 2.4})`} opacity={c.highlight ? 1 : 0.85}>
            <rect x={-r * 2.3} y={-r * 1} width={r * 4.6} height={r * 1.8} rx={r * 0.4} fill="#09090b" opacity={0.8} />
            <text y={r * 0.5} textAnchor="middle" fontSize={r * 1.4} fill="#fafafa" fontWeight={700}>{c.label}</text>
          </g>
        </g>
      ))}
    </svg>
  );
}
