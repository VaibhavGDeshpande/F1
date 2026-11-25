"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { BattlePanel } from "./BattlePanel";
import { LapCompare } from "./LapCompare";
import { GapChart, PitStops, TyreDeg } from "./RaceBoard";
import { CanvasFrame, CanvasToolbar, DashCanvas, useCanvasLayout, type DashBox } from "./DashCanvas";
import { TimingLegend } from "./Legend";
import { DriverTelemetry, FeedTrack, LiveControls, RaceControlList, RadioList, RunningOrder, Tower } from "./LivePanels";
import { StrategyPanel } from "./StrategyPanel";
import { fmtClock, STATUS_STYLE, type LiveFeed, type SessionOption } from "./useLiveFeed";

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
  { id: "weather", x: 0, y: 1530, w: 540, h: 420, z: 1 },
  { id: "compare", x: 550, y: 1530, w: 530, h: 620, z: 1 },
  { id: "gaps", x: 0, y: 2160, w: 1080, h: 380, z: 1 },
  { id: "tyredeg", x: 0, y: 2550, w: 540, h: 420, z: 1 },
  { id: "pits", x: 550, y: 2550, w: 530, h: 420, z: 1 },
];
const SIZES: Record<string, [number, number]> = {
  status: [300, 190], map: [480, 420], order: [280, 420], tower: [720, 520], telemetry: [540, 330], control: [530, 330],
  battle: [540, 320], radio: [530, 320], strategy: [720, 420], weather: [540, 420], compare: [640, 620], gaps: [1080, 380], tyredeg: [540, 420], pits: [530, 420],
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

const MAPS = [["satellite", "Satellite"], ["radar", "Radar"], ["rain", "Rain"], ["clouds", "Clouds"], ["wind", "Wind"]] as const;

/** Live weather map around the circuit (Windy embed: free, no key). Always shows *now*, not the replay time. */
function WeatherMap({ f, height }: { f: LiveFeed; height: number }) {
  const [overlay, setOverlay] = useState<(typeof MAPS)[number][0]>("satellite");
  const { lat, lon } = f.circuit;
  if (lat == null || lon == null) return <p className="muted text-sm">Waiting for the circuit location…</p>;
  const q = new URLSearchParams({
    lat: String(lat), lon: String(lon), detailLat: String(lat), detailLon: String(lon), zoom: "8", level: "surface", overlay,
    product: overlay === "satellite" ? "satellite" : overlay === "radar" ? "radar" : "ecmwf", menu: "", message: "true", marker: "true",
    calendar: "now", type: "map", location: "coordinates", metricWind: "km/h", metricTemp: "°C", radarRange: "-1",
  });
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {MAPS.map(([k, label]) => <button key={k} className={`chip ${overlay === k ? "chip-on" : ""}`} onClick={() => setOverlay(k)}>{label}</button>)}
        {!f.isLive && <span className="muted ml-auto text-[11px]">Shows the weather now, not at the replay time</span>}
      </div>
      <iframe key={overlay} title="Weather map around the circuit" src={`https://embed.windy.com/embed2.html?${q}`} loading="lazy"
        className="w-full rounded-lg border-0" style={{ height: Math.max(160, height) }} />
    </div>
  );
}

/** Canvas layout of the Live page: every panel can be dragged, resized, removed and added back. */
export function TelemetryDashboard({ f, sessions }: { f: LiveFeed; sessions: SessionOption[] }) {
  const { boxes, save } = useCanvasLayout(STORE, DEFAULT);
  const [locked, setLocked] = useState(false);

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
    gaps: { title: "Gap to leader", minW: 360, minH: 260, render: (b: DashBox) => <GapChart f={f} height={b.h - BODY - 70} /> },
    tyredeg: { title: "Tyre wear (current stint)", minW: 320, minH: 220, render: () => <TyreDeg f={f} /> },
    pits: { title: "Pit stops", minW: 300, minH: 200, render: () => <PitStops f={f} /> },
    compare: { title: "Lap compare (telemetry)", minW: 380, minH: 300, render: () => <LapCompare f={f} /> },
    weather: { title: "Weather map (satellite & radar)", minW: 300, minH: 260, render: (b: DashBox) => <WeatherMap f={f} height={b.h - BODY - 40} /> },
    strategy: {
      title: "Strategy", minW: 420, minH: 240,
      render: () => (data?.strategy ? <StrategyPanel bare s={data.strategy} tower={data.tower} /> : <p className="muted text-sm">Strategy appears during races and sprints.</p>),
    },
  };
  return (
    <div className="space-y-3">
      <CanvasFrame tools={<>
        <p className="muted mr-auto text-sm">Drag panels by their title bar, resize from the bottom-right corner, add or remove panels. Your layout is saved in this browser.</p>
        <CanvasToolbar boxes={boxes} save={save} initial={DEFAULT} widgets={widgets} sizes={SIZES} locked={locked} setLocked={setLocked} />
      </>}>
        <div className="card py-3"><LiveControls f={f} sessions={sessions} /></div>
        <DashCanvas boxes={boxes} onChange={save} widgets={widgets} locked={locked} />
      </CanvasFrame>
      <p className="muted flex items-center gap-1 text-[11px]"><Plus size={11} />Tip: focus a title bar with Tab, then use the arrow keys to move it and Shift+arrows to resize.</p>
    </div>
  );
}
