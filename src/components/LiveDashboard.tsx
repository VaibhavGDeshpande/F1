"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtLap } from "@/lib/analysis";
import type { LiveState, TowerRow } from "@/lib/live";
import { compoundColour } from "@/lib/openf1";
import { TelemetryChart } from "./Charts";
import { Countdown, LocalTime } from "./LocalTime";
import { toast } from "./Toaster";
import { teamLogo } from "@/lib/media";
import { Img } from "./Img";
import { TimingLegend } from "./Legend";
import { LiveTrack } from "./LiveTrack";
import { Maximize2, Minimize2 } from "lucide-react";
import type { Corner } from "@/lib/live";
import { liveEvents, type Snap } from "@/lib/live-events";
import { BattlePanel } from "./BattlePanel";
import { StrategyPanel } from "./StrategyPanel";
import { useFullSize } from "./useFullSize";

export type SessionOption = { session_key: number; label: string; date_start: string; date_end: string };

const STATUS_STYLE: Record<string, string> = {
  GREEN: "bg-green-600", "SAFETY CAR": "bg-yellow-500 text-black", VSC: "bg-yellow-500 text-black",
  "SC ENDING": "bg-yellow-300 text-black", "RED FLAG": "bg-red-600", CHEQUERED: "bg-neutral-200 text-black",
};
const SECTOR_STYLE = { purple: "text-purple-400", green: "text-green-400", yellow: "text-yellow-300" } as const;
const SPEEDS =[1, 4, 16]; // faster replays outrun OpenF1's free-tier request budget

export function LiveDashboard({ sessions, liveKey, next }: {
  sessions: SessionOption[]; liveKey: number | null; next: { label: string; date_start: string } | null;
}) {
  const [key, setKey] = useState<number | null>(liveKey ?? sessions[0]?.session_key ?? null);
  const session = sessions.find((s) => s.session_key === key) ?? null;
  const isLive = key != null && key === liveKey;
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [driver, setDriver] = useState<number | null>(null);
  const [data, setData] = useState<(LiveState & { sentAt: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const NO_CIRCUIT = { outline: [], corners: [], rotation: 0 };
  const [circuit, setCircuit] = useState<{ outline: { x: number; y: number }[]; corners: Corner[]; rotation: number }>(NO_CIRCUIT);
  const { ref: mapRef, full, toggle: toggleFull } = useFullSize<HTMLElement>();
  const [replayT, setReplayT] = useState(0);
  const tRef = useRef(0), busy = useRef(false);
  // toasts: penalties, flags, fastest lap, pit stops, retirements that happened since the previous update
  const prevSnap = useRef<Snap | null>(null);
  useEffect(() => {
    if (!data) return;
    const cur: Snap = { t: Date.parse(data.t), status: data.status, race: data.race, raceControl: data.raceControl, tower: data.tower };
    for (const e of liveEvents(prevSnap.current, cur)) toast(e);
    prevSnap.current = cur;
  }, [data]);
  // radio transcripts: url → text, null = in progress. One request at a time; the server caches results.
  const [transcripts, setTranscripts] = useState<Record<string, string | null>>({});
  const radioBusy = useRef(false);
  useEffect(() => {
    const url = data?.radio.find((r) => !(r.recording_url in transcripts))?.recording_url;
    if (!url || radioBusy.current) return;
    radioBusy.current = true;
    setTranscripts((x) => ({ ...x, [url]: null }));
    fetch(`/api/radio-transcript?url=${encodeURIComponent(url)}`)
      .then(async (r) => { const j = await r.json(); return r.ok ? String(j.text) : `⚠ ${j.error ?? `HTTP ${r.status}`}`; })
      .catch((e) => `⚠ ${e}`)
      .then((text) => { radioBusy.current = false; setTranscripts((x) => ({ ...x, [url]: text })); });
  }, [data, transcripts]);

  // new session → reset replay clock to the start and load the circuit outline
  useEffect(() => {
    if (!session) return;
    const start = Date.parse(session.date_start);
    tRef.current = start;
    setReplayT(start);
    setData(null);
    setError(null);
    setCircuit(NO_CIRCUIT);
    fetch(`/api/track?session_key=${session.session_key}`).then((r) => r.json())
      .then((j) => setCircuit({ outline: j.outline ?? [], corners: j.corners ?? [], rotation: j.rotation ?? 0 })).catch(() => {});
  }, [session?.session_key]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!session || busy.current) return;
    busy.current = true;
    try {
      const qs = new URLSearchParams({ session_key: String(session.session_key) });
      if (!isLive) qs.set("t", new Date(tRef.current).toISOString());
      if (driver != null) qs.set("driver", String(driver));
      const sentAt = performance.now(); // the track animation is anchored to when t was asked for, not when it arrived
      const res = await fetch(`/api/live?${qs}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData({ ...j, sentAt });
      setError(null);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      busy.current = false;
    }
  }, [session, isLive, driver]);

  // live: poll every 4 s. replay: advance the clock by speed × 2 s every 2 s.
  useEffect(() => {
    load();
    if (!isLive && !playing) return;
    const id = setInterval(() => {
      if (!isLive && session) {
        tRef.current = Math.min(tRef.current + speed * 2000, Date.parse(session.date_end));
        setReplayT(tRef.current);
      }
      load();
    }, isLive ? 4000 : 2000);
    return () => clearInterval(id);
  }, [load, isLive, playing, speed, session]);

  if (!session) return <p className="muted">No sessions yet this season.</p>;

  const start = Date.parse(session.date_start), end = Date.parse(session.date_end);
  const elapsed = Math.max(0, (data ? Date.parse(data.t) : replayT) - start) / 1000;
  const fmtClock = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const sel = data?.tower.find((r) => r.driver_number === driver);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm" value={key ?? ""} onChange={(e) => setKey(Number(e.target.value))}>
          {sessions.map((s) => <option key={s.session_key} value={s.session_key}>{s.session_key === liveKey ? "● LIVE — " : ""}{s.label}</option>)}
        </select>
        {isLive ? <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold">● LIVE</span> : (
          <>
            <button className="chip" onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
            {SPEEDS.map((s) => <button key={s} className={`chip ${speed === s ? "chip-on" : ""}`} onClick={() => setSpeed(s)}>{s}×</button>)}
          </>
        )}
        {data && <span className={`rounded px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[data.status] ?? "bg-neutral-700"}`}>{data.status}</span>}
        <span className="font-mono text-sm">{fmtClock(elapsed)}</span>
        {data?.weather && (
          <span className="muted text-xs">
            Air {data.weather.air_temperature.toFixed(1)}° · Track {data.weather.track_temperature.toFixed(1)}° · Hum {data.weather.humidity.toFixed(0)}% · Wind {data.weather.wind_speed.toFixed(1)} m/s
            {data.weather.rainfall ? <b className="text-blue-400"> · RAIN</b> : null}
          </span>
        )}
      </div>
      {!isLive && (
        <input type="range" className="w-full accent-red-500" min={start} max={end} step={1000} value={replayT}
          onChange={(e) => { tRef.current = Number(e.target.value); setReplayT(tRef.current); load(); }} aria-label="Replay position" />
      )}
      {!liveKey && next && (
        <p className="muted text-sm">Next live session: <b>{next.label}</b> in <Countdown iso={next.date_start} /> (<LocalTime iso={next.date_start} />). Until then, replay any past session.</p>
      )}
      {error && <p className="rounded border border-red-800 bg-red-950/50 p-2 text-sm text-red-300">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="card overflow-x-auto p-2 xl:col-span-3">
          <Tower rows={data?.tower ?? []} selected={driver} onSelect={(n) => setDriver((d) => (d === n ? null : n))} />
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
              <LiveTrack outline={circuit.outline} corners={circuit.corners} rotation={circuit.rotation} showNames={full} height={full ? "calc(100vh - 2rem)" : 360}
                trails={data?.trails ?? {}}
                anchor={data ? { t: Date.parse(data.t), wall: data.sentAt } : null}
                rate={isLive ? 1 : playing ? speed : 0} lag={isLive ? 4000 : 0}
                cars={[...(data?.tower ?? [])].reverse().map((r) => ({ n: r.driver_number, label: r.acronym, colour: r.colour, highlight: r.driver_number === driver }))} />
              {!full && <p className="muted px-2 pb-1 text-[11px]">Grey circles are corner numbers (hover for the name; names are printed in full-size view).{isLive && " Map runs ~7 s behind real time so the cars move smoothly."}</p>}
            </div>
            {full && (
              <aside className="w-60 shrink-0 overflow-y-auto">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[data?.status ?? ""] ?? "bg-neutral-700"}`}>{data?.status ?? "…"}</span>
                  <span className="font-mono">{fmtClock(elapsed)}</span>
                  <span className="muted ml-auto text-xs">Lap {data?.tower[0]?.lap ?? "–"}</span>
                </div>
                <ol className="space-y-1">
                  {(data?.tower ?? []).map((r) => (
                    <li key={r.driver_number}>
                      <button onClick={() => setDriver((d) => (d === r.driver_number ? null : r.driver_number))}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left font-mono text-sm hover:bg-neutral-800 ${r.driver_number === driver ? "bg-neutral-800 ring-1 ring-white/40" : ""}`}>
                        <span className="w-5 text-right text-neutral-400">{r.position ?? "–"}</span>
                        <span className="h-4 w-1 rounded" style={{ background: r.colour }} />
                        <b>{r.acronym}</b>
                        {r.compound && <span className="h-2.5 w-2.5 rounded-full" style={{ background: compoundColour(r.compound) }} title={r.compound} />}
                        <span className="ml-auto text-xs text-neutral-400">{r.position === 1 ? "Leader" : r.gap ?? ""}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="muted mt-3 text-[11px]">Click a driver to highlight them. Esc to exit.</p>
              </aside>
            )}
          </section>
          {sel && data?.telemetry && (
            <section className="card">
              <h2 className="h2">{sel.acronym} — last 40 s</h2>
              <TelemetryChart xLabel="s" height={160} lines={[{ name: "speed", colour: sel.colour, data: data.telemetry.map((p) => ({ x: p.t, y: p.speed })) }]} />
              <TelemetryChart xLabel="s" height={110} yDomain={[0, 100]} lines={[
                { name: "throttle", colour: "#22c55e", data: data.telemetry.map((p) => ({ x: p.t, y: p.throttle })) },
                { name: "brake", colour: "#ef4444", data: data.telemetry.map((p) => ({ x: p.t, y: p.brake })) },
              ]} />
            </section>
          )}
        </div>
      </div>

      {data?.strategy && (
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3"><StrategyPanel s={data.strategy} tower={data.tower} /></div>
          <div className="xl:col-span-2"><BattlePanel sessionKey={session.session_key} t={data.t} tower={data.tower} /></div>
        </div>
      )}
      {data && !data.strategy && data.tower.length > 1 && <BattlePanel sessionKey={session.session_key} t={data.t} tower={data.tower} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">Race control</h2>
          <ul className="max-h-80 space-y-1.5 overflow-y-auto text-sm">
            {data?.raceControl.map((m, i) => (
              <li key={i} className={/PENALTY|INVESTIGATION|NOTED|DELETED/.test(m.message) ? "text-amber-300" : m.flag === "RED" ? "text-red-400" : ""}>
                <span className="muted mr-2 font-mono text-xs"><LocalTime iso={m.date} withDay={false} />{m.lap_number ? ` · L${m.lap_number}` : ""}</span>{m.message}
              </li>
            ))}
            {data && data.raceControl.length === 0 && <li className="muted">No messages yet.</li>}
          </ul>
        </section>
        <section className="card">
          <h2 className="h2">Team radio</h2>
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {data?.radio.map((r) => {
              const tr = transcripts[r.recording_url];
              return (
                <li key={r.recording_url} className="rounded-xl border border-neutral-800 bg-neutral-950 p-2">
                  <div className="flex items-center gap-2">
                    <span className="w-10 font-mono font-bold">{r.acronym}</span>
                    <span className="muted w-12 font-mono text-xs"><LocalTime iso={r.date} withDay={false} /></span>
                    <audio controls preload="none" src={r.recording_url} className="h-8 flex-1" />
                  </div>
                  <p className={`mt-1 pl-1 text-xs leading-snug ${tr?.startsWith("⚠") ? "text-red-400" : "text-neutral-300"}`}>
                    {tr === undefined ? <span className="muted">Queued for transcript…</span>
                      : tr === null ? <span className="muted animate-pulse">Transcribing…</span>
                      : tr ? <>“{tr}”</> : <span className="muted">(no speech)</span>}
                  </p>
                </li>
              );
            })}
            {data && data.radio.length === 0 && <li className="muted">No radio yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Tower({ rows, selected, onSelect }: { rows: TowerRow[]; selected: number | null; onSelect: (n: number) => void }) {
  if (!rows.length) return <p className="muted p-4 text-sm">Waiting for timing data…</p>;
  return (
    <table className="tbl whitespace-nowrap font-mono text-xs">
      <thead><tr><th>P</th><th>Driver</th><th>Gap</th><th>Int</th><th>Last</th><th>Best</th><th>S1</th><th>S2</th><th>S3</th><th>Tyre</th><th>Pit</th><th>Lap</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.driver_number} onClick={() => onSelect(r.driver_number)} className={`cursor-pointer hover:bg-neutral-800/60 ${selected === r.driver_number ? "bg-neutral-800" : ""}`}>
            <td>{r.out ? <span className="rounded bg-red-600/25 px-1 text-[10px] text-red-300">OUT</span> : r.position ?? "—"}</td>
            <td className="font-sans" title={`${r.name} · ${r.team}`}>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-4 w-1 rounded" style={{ background: r.colour }} />
                <span className="grid w-5 place-items-center"><Img src={teamLogo(r.team, 24)} alt="" className="h-3 w-auto" /></span>
                <b>{r.acronym}</b>
              </span>
            </td>
            <td>{r.gap ?? ""}</td>
            <td>{r.interval ?? ""}</td>
            <td>{fmtLap(r.lastLap)}</td>
            <td>{fmtLap(r.bestLap)}</td>
            {r.sectors.map((s, i) => <td key={i} className={s.colour ? SECTOR_STYLE[s.colour] : ""}>{s.time?.toFixed(3) ?? ""}</td>)}
            <td>{r.compound && <><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: compoundColour(r.compound) }} />{r.compound[0]} {r.tyreAge}</>}</td>
            <td>{r.pits}</td>
            <td>{r.lap ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
