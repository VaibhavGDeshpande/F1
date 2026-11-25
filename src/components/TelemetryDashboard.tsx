"use client";
import { useEffect, useState } from "react";
import { LayoutDashboard, Lock, Plus, RotateCcw, Unlock } from "lucide-react";
import { pushApart } from "@/lib/layout";
import { BattlePanel } from "./BattlePanel";
import { DashCanvas, type DashBox } from "./DashCanvas";
import { TimingLegend } from "./Legend";
import { DriverTelemetry, FeedTrack, LiveControls, RaceControlList, RadioList, RunningOrder, Tower } from "./LivePanels";
import { StrategyPanel } from "./StrategyPanel";
import { fmtClock, STATUS_STYLE, useLiveFeed, type LiveFeed, type SessionOption } from "./useLiveFeed";

const STORE = "pitwall:dashboard:v1";
const BODY = 48; // header + padding inside a widget

// default arrangement for a ~1300 px wide canvas; anything wider just leaves room on the right
const DEFAULT: DashBox[] = [
  { id: "status", x: 0, y: 0, w: 300, h: 190, z: 1 },
  { id: "map", x: 310, y: 0, w: 480, h: 420, z: 1 },
  { id: "order", x: 800, y: 0, w: 280, h: 420, z: 1 },
  { id: "tower", x: 0, y: 200, w: 300, h: 220, z: 1 },
  { id: "telemetry", x: 0, y: 430, w: 540, h: 330, z: 1 },
  { id: "control", x: 550, y: 430, w: 530, h: 330, z: 1 },
  { id: "battle", x: 0, y: 770, w: 540, h: 320, z: 1 },
  { id: "radio", x: 550, y: 770, w: 530, h: 320, z: 1 },
  { id: "strategy", x: 0, y: 1100, w: 1080, h: 420, z: 1 },
];
const SIZES: Record<string, [number, number]> = {
  status: [300, 190], map: [480, 420], order: [280, 420], tower: [720, 520], telemetry: [540, 330], control: [530, 330],
  battle: [540, 320], radio: [530, 320], strategy: [720, 420],
};

function Status({ f }: { f: LiveFeed }) {
  const d = f.data, w = d?.weather;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[d?.status ?? ""] ?? "bg-neutral-700"}`}>{d?.status ?? "…"}</span>
        <span className="font-display text-3xl font-bold">{fmtClock(f.elapsed)}</span>
      </div>
      <div className="text-sm">Lap <b>{d?.tower[0]?.lap ?? "–"}</b>{d?.strategy?.totalLaps ? <span className="muted"> / {d.strategy.totalLaps}</span> : null}</div>
      {w && (
        <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
          {[["Air", `${w.air_temperature.toFixed(1)}°`], ["Track", `${w.track_temperature.toFixed(1)}°`], ["Wind", `${w.wind_speed.toFixed(1)} m/s`],
            ["Humidity", `${w.humidity.toFixed(0)}%`], ["Rain", w.rainfall ? "YES" : "no"]].map(([k, v]) => (
            <div key={k} className="rounded bg-neutral-900 py-1"><div className="font-mono text-sm text-neutral-100">{v}</div>{k}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TelemetryDashboard({ sessions, liveKey }: { sessions: SessionOption[]; liveKey: number | null }) {
  const f = useLiveFeed(sessions, liveKey);
  const [boxes, setBoxes] = useState<DashBox[]>(DEFAULT);
  const [locked, setLocked] = useState(false);
  // saved layout loads after mount (localStorage isn't available during server rendering)
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORE);
      if (!s) return;
      const saved: DashBox[] = JSON.parse(s);
      // layouts saved before panels pushed each other may overlap: settle them from the top down
      const top = [...saved].sort((a, b) => a.y - b.y || a.x - b.x)[0];
      setBoxes(top ? pushApart(saved, top.id) : saved);
    } catch { /* storage blocked: keep default */ }
  }, []);
  const save = (b: DashBox[]) => { setBoxes(b); try { localStorage.setItem(STORE, JSON.stringify(b)); } catch { /* not saved */ } };

  const data = f.data;
  const widgets = {
    status: { title: "Session status & weather", minW: 240, minH: 140, render: () => <Status f={f} /> },
    map: { title: "Track map", minW: 260, minH: 220, render: (b: DashBox) => <FeedTrack f={f} height={b.h - BODY} showNames={b.w > 700} /> },
    order: { title: "Running order", minW: 200, minH: 200, render: () => <RunningOrder f={f} /> },
    tower: {
      title: "Timing tower", minW: 300, minH: 200,
      render: () => <><Tower rows={data?.tower ?? []} selected={f.driver} onSelect={f.toggleDriver} /><div className="mt-2"><TimingLegend /></div></>,
    },
    telemetry: { title: "Driver telemetry", minW: 300, minH: 220, render: (b: DashBox) => <DriverTelemetry f={f} height={b.h - BODY - 20} /> },
    control: { title: "Race control", minW: 260, minH: 160, render: () => <RaceControlList f={f} className="h-full" /> },
    radio: { title: "Team radio", minW: 260, minH: 160, render: () => <RadioList f={f} className="h-full" /> },
    battle: {
      title: "Battle", minW: 320, minH: 220,
      render: () => (data && f.session && data.tower.length > 1 ? <BattlePanel bare sessionKey={f.session.session_key} t={data.t} tower={data.tower} /> : <p className="muted text-sm">Waiting for timing data…</p>),
    },
    strategy: {
      title: "Strategy", minW: 420, minH: 240,
      render: () => (data?.strategy ? <StrategyPanel bare s={data.strategy} tower={data.tower} /> : <p className="muted text-sm">Strategy appears during races and sprints.</p>),
    },
  };
  const missing = Object.keys(widgets).filter((id) => !boxes.some((b) => b.id === id));
  const add = (id: string) => {
    const bottom = Math.max(0, ...boxes.map((b) => b.y + b.h));
    const [w, h] = SIZES[id] ?? [400, 300];
    save([...boxes, { id, x: 0, y: bottom + 10, w, h, z: Math.max(0, ...boxes.map((b) => b.z)) + 1 }]);
  };

  if (!f.session) return <p className="muted">No sessions yet this season.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="h1 flex items-center gap-3"><LayoutDashboard size={28} />Telemetry dashboard</h1>
          <p className="muted text-sm">Build your own pit wall: drag panels by their title bar, resize from the bottom-right corner, add or remove panels. Your layout is saved in this browser.</p>
        </div>
        <select className="select" value="" aria-label="Add widget" disabled={!missing.length} onChange={(e) => e.target.value && add(e.target.value)}>
          <option value="">{missing.length ? "+ Add widget…" : "All widgets on canvas"}</option>
          {missing.map((id) => <option key={id} value={id}>{widgets[id as keyof typeof widgets].title}</option>)}
        </select>
        <button className={`pill flex items-center gap-1 ${locked ? "pill-on" : ""}`} onClick={() => setLocked((l) => !l)}>
          {locked ? <Lock size={12} /> : <Unlock size={12} />}{locked ? "Locked" : "Lock layout"}
        </button>
        <button className="pill flex items-center gap-1" onClick={() => save(DEFAULT)}><RotateCcw size={12} />Reset layout</button>
      </div>
      <div className="card py-3"><LiveControls f={f} sessions={sessions} /></div>
      <DashCanvas boxes={boxes} onChange={save} widgets={widgets} locked={locked} />
      <p className="muted flex items-center gap-1 text-[11px]"><Plus size={11} />Tip: focus a title bar with Tab, then use the arrow keys to move it and Shift+arrows to resize.</p>
    </div>
  );
}
