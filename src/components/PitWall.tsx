"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, BatteryWarning, Check, CornerDownRight, Gauge, Layers, Link2, MapPin, Maximize2, Minimize2, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { clippingEvents, cornerAnalysis } from "@/lib/corner-analysis";
import { ClippingPanel } from "./ClippingPanel";
import { CornerTable } from "./CornerTable";
import { deltaTrace, fmtLap, lapModel, type TelPoint } from "@/lib/analysis";
import type { Corner } from "@/lib/live";
import { Track3D } from "./Track3D";
import { useFullSize } from "./useFullSize";
import type { Stint } from "@/lib/openf1";
import { TyreLegend } from "./Legend";
import { StintChart } from "./StintChart";
import { TrackMap } from "./TrackMap";

export type PWDriver = { n: number; code: string; name: string; team: string; colour: string; headshot: string | null; laps: { lap: number; time: number }[] };
type Mode = "focus" | "overlay";
type Tel = { points: TelPoint[]; path: { x: number; y: number; z?: number; t: number }[] };
type Props = {
  year: number; years: number[]; meetings: { round: number; name: string }[]; round: number; title: string; flag: string | null;
  sessions: { code: string; name: string; started: boolean }[]; sessionCode: string; sessionKey: number;
  drivers: PWDriver[]; stints: Stint[];
  initial: { codes: string[]; ref: string; mode: Mode; picks: Record<string, number> };
};

const MAX_DRIVERS = 4;
const SPEEDS = [0.5, 1, 2, 4];
const FALLBACK = ["#ffffff", "#a3e635", "#f472b6", "#22d3ee"];
const tooltip = { contentStyle: { background: "#0b0b0d", border: "1px solid #333", fontSize: 11 }, labelStyle: { color: "#999" } };

const fastest = (d: PWDriver) => d.laps.reduce<PWDriver["laps"][number] | null>((a, l) => (!a || l.time < a.time ? l : a), null);
const rgbDist = (a: string, b: string) => {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [c(a), c(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
/** Last sample at or before t (arrays are sorted by t). */
function sampleAt<T extends { t: number }>(arr: T[], t: number): T | undefined {
  let lo = 0, hi = arr.length - 1;
  if (hi < 0) return undefined;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid].t <= t) lo = mid; else hi = mid - 1;
  }
  return arr[lo];
}
function posAt(path: Tel["path"], t: number) {
  const a = sampleAt(path, t);
  if (!a) return null;
  const b = path[path.indexOf(a) + 1];
  if (!b || b.t === a.t) return a;
  const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) };
}
const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

export function PitWall(p: Props) {
  const router = useRouter();
  const byCode = useMemo(() => Object.fromEntries(p.drivers.map((d) => [d.code, d])), [p.drivers]);
  const [codes, setCodes] = useState(p.initial.codes);
  const [ref, setRef] = useState(p.initial.ref);
  const [mode, setMode] = useState<Mode>(p.initial.mode);
  const [picks, setPicks] = useState(p.initial.picks);
  const [tel, setTel] = useState<Record<string, Tel>>({});
  const [err, setErr] = useState<string | null>(null);
  const fs = useFullSize<HTMLElement>();
  const [view, setView] = useState<"2d" | "3d">("2d");
  // corner numbers/names and TV orientation for the 2D map
  const [circuit, setCircuit] = useState<{ corners: Corner[]; rotation: number }>({ corners: [], rotation: 0 });
  useEffect(() => {
    if (!p.sessionKey) return;
    fetch(`/api/track?session_key=${p.sessionKey}`).then((r) => r.json())
      .then((j) => setCircuit({ corners: j.corners ?? [], rotation: j.rotation ?? 0 })).catch(() => {});
  }, [p.sessionKey]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [copied, setCopied] = useState(false);
  const [hideOutliers, setHideOutliers] = useState(true);
  const loading = useRef(new Set<string>());

  // the selected drivers, each with its lap, colour and telemetry (if loaded)
  const active = useMemo(() => {
    const used: string[] = [];
    return codes.flatMap((code) => {
      const d = byCode[code];
      const lap = picks[code] ?? (d && fastest(d)?.lap);
      if (!d || !lap) return [];
      const colour = used.every((u) => rgbDist(u, d.colour) > 120) ? d.colour : FALLBACK.find((f) => !used.includes(f))!;
      used.push(colour);
      return [{ d, lap, colour, time: d.laps.find((l) => l.lap === lap)?.time ?? null, tel: tel[`${d.n}:${lap}`] as Tel | undefined }];
    });
  }, [codes, picks, tel, byCode]);
  const refA = active.find((a) => a.d.code === ref) ?? active[0];
  const loaded = active.filter((a) => a.tel);
  // memoised chart inputs: the play-head ticks 10×/s and must not rebuild these
  const traces = useMemo(
    () => (mode === "focus" ? active.filter((a) => a === refA) : active).filter((a) => a.tel).map((a) => ({ code: a.d.code, colour: a.colour, points: a.tel!.points })),
    [active, mode, refA],
  );
  const deltas = useMemo(
    () => (refA?.tel ? active.filter((a) => a !== refA && a.tel).map((a) => ({ code: a.d.code, colour: a.colour, data: deltaTrace(refA.tel!.points, a.tel!.points) })) : []),
    [active, refA],
  );
  const lapSeries = useMemo(() => active.map((a) => ({ code: a.d.code, colour: a.colour, laps: a.d.laps, picked: a.lap })), [active]);
  const sectors = useMemo(() => (loaded.length > 1 ? miniSectors(loaded.map((a) => ({ tel: a.tel!, colour: a.colour }))) : undefined), [active]); // eslint-disable-line react-hooks/exhaustive-deps
  // corner-by-corner (reference driver first) and energy clipping per driver; recomputed only when laps change
  const cornerOrder = useMemo(() => (refA?.tel ? [refA, ...loaded.filter((a) => a !== refA)] : []), [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const cornerRows = useMemo(
    () => (cornerOrder.length && circuit.corners.length ? cornerAnalysis(cornerOrder.map((a) => a.tel!.points), cornerOrder[0].tel!.path, circuit.corners) : []),
    [cornerOrder, circuit.corners],
  );
  const cornerWho = cornerOrder.map((a) => ({ code: a.d.code, colour: a.colour }));
  const clipRows = useMemo(() => cornerOrder.map((a) => {
    const refLength = cornerOrder[0].tel!.points.at(-1)?.d ?? 1;
    const pts = a.tel!.points, scale = refLength / (pts.at(-1)?.d || 1);
    return {
      code: a.d.code, colour: a.colour,
      // label each clip by the last corner before it (corner distances are on the reference lap's scale)
      clips: clippingEvents(pts).map((c) => ({ ...c, after: [...cornerRows].reverse().find((r) => r.d < c.startD * scale)?.label ?? null })),
    };
  }), [cornerOrder, cornerRows]);
  const clipAreas = useMemo(() => clipRows.flatMap((r) => r.clips.map((c) => ({ x1: c.startD, x2: c.endD, colour: r.colour }))), [clipRows]);
  // stable between play-head ticks, so the 3D scene isn't rebuilt 10×/s
  const model = useMemo(() => (refA?.tel ? lapModel(refA.tel.points, refA.tel.path) : []), [refA?.tel]);
  const maxT = Math.max(0, ...loaded.map((a) => a.tel!.points.at(-1)?.t ?? 0));

  // keep the URL shareable without a server round-trip
  const href = (over: Record<string, string> = {}) => {
    const q = new URLSearchParams({ year: String(p.year), round: String(p.round), session: p.sessionCode, mode, drivers: codes.join(","), ref });
    const custom = active.filter((a) => a.lap !== fastest(a.d)?.lap);
    if (custom.length) q.set("laps", custom.map((a) => `${a.d.code}:${a.lap}`).join(","));
    else q.set("fastest", "1");
    for (const [k, v] of Object.entries(over)) q.set(k, v);
    return `/pit-wall?${q}`;
  };
  useEffect(() => {
    if (p.sessionKey) window.history.replaceState(null, "", href());
  }, [codes, ref, mode, picks]); // eslint-disable-line react-hooks/exhaustive-deps

  // load telemetry for each selected lap
  useEffect(() => {
    for (const a of active) {
      const k = `${a.d.n}:${a.lap}`;
      if (a.tel || loading.current.has(k)) continue;
      loading.current.add(k);
      fetch(`/api/telemetry?session_key=${p.sessionKey}&driver=${a.d.n}&lap=${a.lap}`)
        .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)))
        .then((j: Tel) => setTel((prev) => ({ ...prev, [k]: j })))
        .catch((e) => setErr(`${a.d.code} lap ${a.lap}: ${e}`))
        .finally(() => loading.current.delete(k));
    }
  }, [active, p.sessionKey]);

  // playback clock
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(); // real elapsed time, so throttled timers don't slow the replay
      setT((x) => Math.min(x + ((now - last) / 1000) * speed, maxT));
      last = now;
    }, 100);
    return () => clearInterval(id);
  }, [playing, speed, maxT]);
  useEffect(() => {
    if (playing && t >= maxT) setPlaying(false);
  }, [t, maxT, playing]);

  const toggle = (code: string) => {
    setErr(null);
    if (codes.includes(code)) {
      if (codes.length === 1) return;
      const next = codes.filter((c) => c !== code);
      setCodes(next);
      if (ref === code) setRef(next[0]);
    } else if (codes.length < MAX_DRIVERS) setCodes([...codes, code]);
  };
  const pick = useCallback((code: string, lap: number) => { setPicks((x) => ({ ...x, [code]: lap })); setT(0); }, []);

  // per-driver readout at the playhead
  const now = active.map((a) => ({ a, s: a.tel ? sampleAt(a.tel.points, t) : undefined, pos: a.tel ? posAt(a.tel.path, t) : null }));
  const refNow = now.find((n) => n.a === refA);
  const refLen = refA?.tel?.points.at(-1)?.d ?? 1;
  const cursor = Math.min(1, (refNow?.s?.d ?? 0) / refLen);

  if (!p.sessionKey) {
    return <div className="space-y-4"><Selector {...p} mode={mode} setMode={setMode} router={router} href={href} copied={copied} onCopy={() => {}} /><p className="muted">No session has run at this Grand Prix yet.</p></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Pit Wall</h1>
        <p className="muted text-sm">Telemetry, gaps and inputs lined up on the same lap. Pick your drivers, then press play.</p>
      </div>

      <Selector {...p} mode={mode} setMode={setMode} router={router} href={href} copied={copied}
        onCopy={() => { navigator.clipboard?.writeText(location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} />

      <section className="card flex flex-wrap items-center gap-3 py-3">
        <button aria-label={playing ? "Pause" : "Play"} className="grid h-10 w-10 place-items-center rounded-full bg-red-600 hover:bg-red-500"
          onClick={() => { if (t >= maxT) setT(0); setPlaying((x) => !x); }} disabled={!maxT}>
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <button aria-label="Restart" className="grid h-9 w-9 place-items-center rounded-full border border-neutral-700 hover:bg-neutral-800" onClick={() => { setT(0); setPlaying(false); }}>
          <RotateCcw size={15} />
        </button>
        <span className="text-xs font-semibold">Lap replay</span>
        <span className="font-mono text-xs text-neutral-400">{clock(t)} / {clock(maxT)}</span>
        <div className="ml-auto flex gap-1 rounded-xl bg-neutral-950 p-1">
          {SPEEDS.map((s) => <button key={s} className={`pill ${speed === s ? "!bg-white !text-black" : "bg-transparent"}`} onClick={() => setSpeed(s)}>{s}x</button>)}
        </div>
        <input type="range" min={0} max={maxT || 1} step={0.05} value={t} onChange={(e) => { setT(Number(e.target.value)); setPlaying(false); }}
          className="w-full accent-red-600" aria-label="Playback position" />
      </section>

      {err && <p className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">Telemetry unavailable for {err}</p>}

      <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* drivers */}
        <section className="card p-2 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          <div className="px-2 py-1 text-xs"><span className="font-semibold text-red-500">Drivers</span> <span className="muted">{codes.length}/{p.drivers.length}</span></div>
          <ul className="space-y-1">
            {p.drivers.map((d) => {
              const a = active.find((x) => x.d === d), s = now.find((x) => x.a.d === d)?.s;
              return (
                <li key={d.code}>
                  <button onClick={() => toggle(d.code)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition ${a ? "bg-neutral-900" : "border-transparent hover:bg-neutral-900/60"}`}
                    style={a ? { borderColor: a.colour } : undefined}>
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${a ? "border-transparent" : "border-neutral-600"}`} style={a ? { background: a.colour } : undefined}>
                      {a && <Check size={11} className="text-black" strokeWidth={3} />}
                    </span>
                    {d.headshot ? <img src={d.headshot} alt="" className="h-7 w-7 rounded-full bg-neutral-800 object-cover" loading="lazy" /> : <span className="h-7 w-7 rounded-full bg-neutral-800" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-mono text-sm font-bold">
                        <span className="h-3 w-1 rounded" style={{ background: d.colour }} />{d.code}
                        {a && a.d.code === refA?.d.code && <span className="rounded bg-white/10 px-1 text-[9px] font-semibold">REF</span>}
                      </span>
                      <span className="block font-mono text-[11px] text-neutral-400">{s ? `${s.speed} km/h` : fmtLap(fastest(d)?.time)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* track + inputs + stints */}
        <div className="space-y-4">
          <section ref={fs.ref} className={fs.full ? "fixed inset-0 z-[60] flex flex-col bg-[#08080a] p-4" : "card"}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="h2 mb-0 mr-auto"><MapPin size={14} />Track position</h2>
              <div className="flex rounded-lg bg-neutral-950 p-0.5">
                {(["2d", "3d"] as const).map((v) => (
                  <button key={v} className={`pill py-1 uppercase ${view === v ? "!bg-white !text-black" : "bg-transparent"}`} onClick={() => setView(v)}>{v}</button>
                ))}
              </div>
              <button onClick={fs.toggle} aria-label={fs.full ? "Exit full screen" : "Show track full screen"} title={fs.full ? "Exit full screen (Esc)" : "Full screen"}
                className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-700 hover:bg-neutral-800">
                {fs.full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {view === "3d" && model.length > 20 ? (
                <Track3D points={model} height={fs.full ? Math.max(400, window.innerHeight - 110) : 300} />
              ) : (
                <TrackMap outline={refA?.tel?.path ?? []} height={fs.full ? "calc(100vh - 6.5rem)" : 300} transitionMs={110}
                  corners={circuit.corners} rotation={circuit.rotation} showNames={fs.full} segments={sectors}
                  cars={now.filter((n) => n.pos).map((n) => ({ ...n.pos!, label: n.a.d.code, colour: n.a.colour, highlight: n.a === refA }))} />
              )}
            </div>
            <p className="muted mt-1 text-[11px]">
              {view === "3d" ? `3D model of ${refA?.d.code ?? "the reference"}'s lap: height exaggerated, coloured by speed. Drag to turn.`
                : <>{loaded.length > 1 && "Track coloured by the faster driver in each of 25 mini-sectors. "}Grey circles are corner numbers{fs.full ? "." : " (hover for names)."}</>}
            </p>
          </section>

          <section className="card">
            <h2 className="h2"><Gauge size={14} />Live inputs</h2>
            <p className="muted mb-3 text-[11px]">Each driver at the play-head: speed, gear, rpm, plus <span className="text-green-400">throttle (T)</span> and <span className="text-red-400">brake (B)</span>.</p>
            <div className="space-y-2">
              {now.map(({ a, s }) => (
                <div key={a.d.code} className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2" style={{ borderLeft: `3px solid ${a.colour}` }}>
                  <span className="w-10 font-mono font-bold" style={{ color: a.colour }}>{a.d.code}</span>
                  <Stat v={s?.speed ?? "—"} u="km/h" /><Stat v={s?.gear ?? "—"} u="gear" /><Stat v={s ? `${(s.rpm / 1000).toFixed(1)}k` : "—"} u="rpm" />
                  <div className="ml-auto space-y-1">
                    <Dots label="T" on={Math.round((s?.throttle ?? 0) / 10)} colour="#22c55e" />
                    <Dots label="B" on={s?.brake ? 10 : 0} colour="#ef4444" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="h2"><Layers size={14} />Stints</h2>
            <StintChart stints={p.stints} order={active.map((a) => a.d.n)} names={Object.fromEntries(active.map((a) => [a.d.n, a.d.code]))} />
            <div className="mt-2"><TyreLegend /></div>
          </section>
        </div>

        {/* telemetry + lap times */}
        <div className="space-y-4">
          <section className="card">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="h2 mb-0 mr-auto"><Activity size={14} />Telemetry</h2>
              <button className="pill pill-on" onClick={() => { setPicks({}); setT(0); }}>Fastest lap</button>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              {active.map((a) => (
                <span key={a.d.code} className="rounded-full border px-2 py-0.5 font-mono text-[11px]" style={{ borderColor: a.colour }}>
                  <b style={{ color: a.colour }}>{a.d.code}</b>, lap {a.lap} {fmtLap(a.time)}
                </span>
              ))}
            </div>
            {loaded.length === 0 ? <p className="muted py-10 text-center text-sm">Loading telemetry…</p> : (
              <div className="relative">
                <Traces shown={traces} deltas={deltas} refCode={refA?.d.code ?? ""} maxD={refLen} clipAreas={clipAreas} />
                <div className="pointer-events-none absolute inset-y-0 w-px bg-white/70" style={{ left: `calc(40px + (100% - 48px) * ${cursor})` }} />
              </div>
            )}
          </section>

          <section className="card">
            <div className="mb-1 flex items-center">
              <h2 className="h2 mb-0 mr-auto"><Timer size={14} />Lap times</h2>
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={hideOutliers} onChange={(e) => setHideOutliers(e.target.checked)} />Hide outliers</label>
            </div>
            <p className="muted mb-2 text-[11px]">Click a lap to load its telemetry.</p>
            <LapTimes series={lapSeries} hideOutliers={hideOutliers} onPick={pick} />
          </section>
        </div>
      </div>

      {loaded.length > 0 && (
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="card">
            <h2 className="h2"><CornerDownRight size={14} />Corner by corner</h2>
            <CornerTable rows={cornerRows} who={cornerWho} />
          </section>
          <section className="card">
            <h2 className="h2"><BatteryWarning size={14} />Energy clipping</h2>
            <ClippingPanel rows={clipRows} />
          </section>
        </div>
      )}
    </div>
  );
}

function Selector(p: Props & { mode: Mode; setMode: (m: Mode) => void; router: ReturnType<typeof useRouter>; href: (o?: Record<string, string>) => string; copied: boolean; onCopy: () => void }) {
  const go = (over: Record<string, string>) => p.router.push(p.href(over));
  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {p.flag && <img src={p.flag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />}{p.title}
        <span className="font-normal text-neutral-400">{p.sessions.find((s) => s.code === p.sessionCode)?.name}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-2">
          <select className="select" value={p.year} aria-label="Season" onChange={(e) => go({ year: e.target.value, round: "1", session: "Q" })}>
            {p.years.map((y) => <option key={y}>{y}</option>)}
          </select>
          <select className="select min-w-56 flex-1" value={p.round} aria-label="Grand Prix" onChange={(e) => go({ round: e.target.value, session: "Q" })}>
            {p.meetings.map((m) => <option key={m.round} value={m.round}>R{m.round} · {m.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-neutral-950 p-1">
            {(["focus", "overlay"] as const).map((m) => (
              <button key={m} className={`pill capitalize ${p.mode === m ? "!bg-white !text-black" : "bg-transparent"}`} onClick={() => p.setMode(m)}>{m}</button>
            ))}
          </div>
          <button aria-label="Copy share link" title="Copy share link" onClick={p.onCopy} className="grid h-9 w-9 place-items-center rounded-full border border-neutral-700 hover:bg-neutral-800">
            {p.copied ? <Check size={15} /> : <Link2 size={15} />}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {p.sessions.map((s) => (
          <button key={s.code} disabled={!s.started} onClick={() => go({ session: s.code })}
            className={`pill ${s.code === p.sessionCode ? "pill-on" : ""} disabled:opacity-40`}>{s.name}</button>
        ))}
      </div>
    </section>
  );
}

const Stat = ({ v, u }: { v: string | number; u: string }) => (
  <div className="leading-tight"><div className="font-mono text-lg font-bold">{v}</div><div className="text-[10px] text-neutral-500">{u}</div></div>
);

const Dots = ({ label, on, colour }: { label: string; on: number; colour: string }) => (
  <div className="flex items-center gap-1">
    <span className="w-3 text-[10px] font-bold" style={{ color: colour }}>{label}</span>
    {Array.from({ length: 10 }, (_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < on ? colour : "#2a2a2a" }} />)}
  </div>
);

type TraceLine = { code: string; colour: string; points: TelPoint[] };
const CHANNELS = [
  { key: "speed", label: "Speed (km/h)", h: 140 },
  { key: "throttle", label: "Throttle (%)", h: 80, domain: [0, 100] },
  { key: "brake", label: "Brake", h: 55, domain: [0, 100], step: true },
  { key: "gear", label: "Gear", h: 80, domain: [1, 8], step: true },
  { key: "rpm", label: "RPM", h: 80 },
] as const;

/** Stacked distance-based traces. Memoised so the moving play-head cursor doesn't re-render the charts. */
const Traces = memo(function Traces({ shown, deltas, refCode, maxD, clipAreas = [] }: {
  shown: TraceLine[]; deltas: { code: string; colour: string; data: { d: number; delta: number }[] }[]; refCode: string; maxD: number;
  clipAreas?: { x1: number; x2: number; colour: string }[]; // energy clipping zones, shaded on the speed trace
}) {
  const chart = (label: string, h: number, lines: { name: string; colour: string; data: { x: number; y: number }[] }[], opts: { domain?: readonly [number, number]; step?: boolean; last?: boolean; areas?: typeof clipAreas } = {}) => (
    <div key={label}>
      <div className="text-[10px] font-semibold text-neutral-400">{label}</div>
      <ResponsiveContainer width="100%" height={h + (opts.last ? 18 : 0)}>
        <LineChart syncId="pitwall" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1d1d1f" vertical={false} />
          <XAxis type="number" dataKey="x" domain={[0, maxD]} allowDataOverflow hide={!opts.last} stroke="#555" fontSize={10} tickFormatter={(v: number) => `${Math.round(v)}m`} />
          <YAxis width={40} stroke="#555" fontSize={10} domain={opts.domain ? [...opts.domain] : ["auto", "auto"]} tickCount={3} />
          <Tooltip {...tooltip} labelFormatter={(l) => `${Math.round(Number(l))} m`} formatter={(v) => Number(v).toFixed(label.startsWith("Δ") ? 3 : 0)} />
          {opts.areas?.map((a, k) => <ReferenceArea key={k} x1={a.x1} x2={a.x2} fill={a.colour} fillOpacity={0.18} stroke={a.colour} strokeOpacity={0.4} ifOverflow="hidden" />)}
          {lines.map((l) => (
            <Line key={l.name} data={l.data} dataKey="y" name={l.name} stroke={l.colour} dot={false} strokeWidth={1.4} isAnimationActive={false} type={opts.step ? "stepAfter" : "linear"} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
  return (
    <div className="space-y-1">
      {deltas.length > 0 && chart(`Δ vs ${refCode} (s, + = slower)`, 90, deltas.map((d) => ({ name: d.code, colour: d.colour, data: d.data.map((p) => ({ x: p.d, y: p.delta })) })))}
      {CHANNELS.map((c, i) =>
        chart(c.label, c.h, shown.map((s) => ({ name: s.code, colour: s.colour, data: s.points.map((p) => ({ x: p.d, y: p[c.key] })) })),
          { domain: "domain" in c ? c.domain : undefined, step: "step" in c, last: i === CHANNELS.length - 1, areas: c.key === "speed" ? clipAreas : undefined }),
      )}
    </div>
  );
});

const LapTimes = memo(function LapTimes({ series, hideOutliers, onPick }: {
  series: { code: string; colour: string; laps: { lap: number; time: number }[]; picked: number }[];
  hideOutliers: boolean; onPick: (code: string, lap: number) => void;
}) {
  const best = Math.min(...series.flatMap((s) => s.laps.map((l) => l.time)));
  const rows = new Map<number, Record<string, number>>();
  for (const s of series) for (const l of s.laps) {
    if (hideOutliers && l.time > best * 1.07) continue;
    const r = rows.get(l.lap) ?? { lap: l.lap };
    r[s.code] = l.time;
    rows.set(l.lap, r);
  }
  const data = [...rows.values()].sort((a, b) => a.lap - b.lap);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#1d1d1f" vertical={false} />
        <XAxis dataKey="lap" stroke="#555" fontSize={10} />
        <YAxis width={56} stroke="#555" fontSize={10} domain={["dataMin - 0.3", "dataMax + 0.3"]} tickFormatter={fmtLap} />
        <Tooltip {...tooltip} labelFormatter={(l) => `Lap ${l}`} formatter={(v) => fmtLap(Number(v))} />
        {series.map((s) => (
          <Line key={s.code} dataKey={s.code} stroke={s.colour} strokeWidth={1.5} connectNulls isAnimationActive={false}
            dot={(d: { cx?: number; cy?: number; index: number; payload: { lap: number } }) => d.cx == null || d.cy == null ? <g key={`${s.code}-${d.index}`} /> : (
              <g key={`${s.code}-${d.index}`} style={{ cursor: "pointer" }} onClick={() => onPick(s.code, d.payload.lap)}>
                <circle cx={d.cx} cy={d.cy} r={9} fill="transparent" />
                <circle cx={d.cx} cy={d.cy} r={d.payload.lap === s.picked ? 5 : 3} fill={s.colour} stroke={d.payload.lap === s.picked ? "#fff" : "none"} />
              </g>
            )} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
});

/** Split the reference path into 25 equal-distance mini-sectors; colour each by the driver with the highest average speed there. */
function miniSectors(laps: { tel: Tel; colour: string }[], n = 25) {
  const path = laps[0].tel.path;
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const len = cum.at(-1) || 1;
  const avg = (pts: TelPoint[], lo: number, hi: number) => {
    const total = pts.at(-1)?.d || 1;
    const s = pts.filter((q) => q.d / total >= lo && q.d / total < hi);
    return s.reduce((a, q) => a + q.speed, 0) / (s.length || 1);
  };
  return Array.from({ length: n }, (_, k) => {
    const lo = k / n, hi = (k + 1) / n;
    const best = laps.reduce((a, l) => (avg(l.tel.points, lo, hi) > avg(a.tel.points, lo, hi) ? l : a));
    return { points: path.filter((_, i) => cum[i] / len >= lo && cum[i] / len <= hi + 0.01), colour: best.colour };
  });
}
