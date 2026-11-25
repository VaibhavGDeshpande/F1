"use client";
import { useEffect, useState } from "react";
import { LayoutDashboard, LayoutList, Maximize2, Minimize2 } from "lucide-react";
import { BattlePanel } from "./BattlePanel";
import { TimingLegend } from "./Legend";
import { DriverTelemetry, FeedTrack, LiveControls, RaceControlList, RadioList, RunningOrder, Tower } from "./LivePanels";
import { Countdown, LocalTime } from "./LocalTime";
import { StrategyPanel } from "./StrategyPanel";
import { useFullSize } from "./useFullSize";
import { TelemetryDashboard } from "./TelemetryDashboard";
import { fmtClock, STATUS_STYLE, useLiveFeed, type LiveFeed, type SessionOption } from "./useLiveFeed";

export type { SessionOption } from "./useLiveFeed";

type Layout = "classic" | "canvas";
const LAYOUT_KEY = "pitwall:live-layout";

/** The Live page: one live feed, shown either as the classic page or as the drag-and-resize canvas. */
export function LiveView({ sessions, liveKey, next, initialLayout }: {
  sessions: SessionOption[]; liveKey: number | null; next: { label: string; date_start: string } | null; initialLayout?: Layout;
}) {
  const f = useLiveFeed(sessions, liveKey);
  const [layout, setLayoutState] = useState<Layout>(initialLayout ?? "classic");
  useEffect(() => {
    if (initialLayout) return; // a link asked for a layout
    try { if (localStorage.getItem(LAYOUT_KEY) === "canvas") setLayoutState("canvas"); } catch { /* storage blocked */ }
  }, [initialLayout]);
  const setLayout = (v: Layout) => { setLayoutState(v); try { localStorage.setItem(LAYOUT_KEY, v); } catch { /* not saved */ } };
  if (!f.session) return <p className="muted">No sessions yet this season.</p>;

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl bg-neutral-950 p-1 sm:w-fit">
        {(["classic", "canvas"] as const).map((v) => (
          <button key={v} className={`pill flex items-center gap-1 ${layout === v ? "!bg-white !text-black" : "bg-transparent"}`} onClick={() => setLayout(v)}>
            {v === "classic" ? <><LayoutList size={12} />Classic layout</> : <><LayoutDashboard size={12} />Canvas (drag &amp; resize)</>}
          </button>
        ))}
      </div>
      {layout === "canvas" ? <TelemetryDashboard f={f} sessions={sessions} /> : <LiveDashboard f={f} sessions={sessions} liveKey={liveKey} next={next} />}
    </div>
  );
}

function LiveDashboard({ f, sessions, liveKey, next }: {
  f: LiveFeed; sessions: SessionOption[]; liveKey: number | null; next: { label: string; date_start: string } | null;
}) {
  const { ref: mapRef, full, toggle: toggleFull } = useFullSize<HTMLElement>();
  const { data } = f;

  return (
    <div className="space-y-4">
      <LiveControls f={f} sessions={sessions} />
      {!liveKey && next && (
        <p className="muted text-sm">Next live session: <b>{next.label}</b> in <Countdown iso={next.date_start} /> (<LocalTime iso={next.date_start} />). Until then, replay any past session.</p>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="card overflow-x-auto p-2 xl:col-span-3">
          <Tower rows={data?.tower ?? []} selected={f.driver} onSelect={f.toggleDriver} />
          <div className="mt-2 space-y-1 px-2">
            <TimingLegend />
            <p className="muted text-[11px]">Click a driver for their speed, throttle and brake, and to highlight them on the map.</p>
          </div>
        </section>
        <div className="space-y-4 xl:col-span-2">
          <section ref={mapRef} className={full ? "fixed inset-0 z-[60] flex gap-3 bg-[#08080a] p-4" : "card relative p-2"}>
            <button onClick={toggleFull} aria-label={full ? "Exit full screen" : "Show circuit full screen"} title={full ? "Exit full screen (Esc)" : "Full screen"}
              className="absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg border border-neutral-700 bg-neutral-900/90 hover:bg-neutral-800">
              {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <div className="min-w-0 flex-1">
              <FeedTrack f={f} showNames={full} height={full ? "calc(100vh - 2rem)" : 360} />
              {!full && <p className="muted px-2 pb-1 text-[11px]">Grey circles are corner numbers (hover for the name; names are printed in full-size view).{f.isLive && " Map runs ~7 s behind real time so the cars move smoothly."}</p>}
            </div>
            {full && (
              <aside className="w-60 shrink-0 overflow-y-auto">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[data?.status ?? ""] ?? "bg-neutral-700"}`}>{data?.status ?? "…"}</span>
                  <span className="font-mono">{fmtClock(f.elapsed)}</span>
                  <span className="muted ml-auto text-xs">Lap {data?.tower[0]?.lap ?? "–"}</span>
                </div>
                <RunningOrder f={f} />
                <p className="muted mt-3 text-[11px]">Click a driver to highlight them. Esc to exit.</p>
              </aside>
            )}
          </section>
          {f.driver != null && data?.telemetry && <section className="card"><DriverTelemetry f={f} /></section>}
        </div>
      </div>

      {data?.strategy && (
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3"><StrategyPanel s={data.strategy} tower={data.tower} /></div>
          <div className="xl:col-span-2"><BattlePanel sessionKey={f.session!.session_key} t={data.t} tower={data.tower} /></div>
        </div>
      )}
      {data && !data.strategy && data.tower.length > 1 && <BattlePanel sessionKey={f.session!.session_key} t={data.t} tower={data.tower} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="h2">Race control</h2><RaceControlList f={f} /></section>
        <section className="card"><h2 className="h2">Team radio</h2><RadioList f={f} /></section>
      </div>
    </div>
  );
}
