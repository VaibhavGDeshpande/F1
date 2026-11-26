"use client";
// Building blocks shared by the Live page and the drag-and-drop telemetry dashboard.
import { fmtLap } from "@/lib/analysis";
import type { TowerRow } from "@/lib/live";
import { teamLogo } from "@/lib/media";
import { compoundColour } from "@/lib/openf1";
import { TelemetryChart } from "./Charts";
import { Img } from "./Img";
import { LocalTime } from "./LocalTime";
import { LiveTrack } from "./LiveTrack";
import { fmtClock, SPEEDS, STATUS_STYLE, type LiveFeed, type SessionOption } from "./useLiveFeed";

const SECTOR_STYLE = { purple: "text-purple-400", green: "text-green-400", yellow: "text-yellow-300" } as const;

/** Session picker, play/speed, track status, clock, weather and the replay slider. */
export function LiveControls({ f, sessions, slider = true }: { f: LiveFeed; sessions: SessionOption[]; slider?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <select className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm" value={f.key ?? ""} onChange={(e) => f.setKey(Number(e.target.value))} aria-label="Session">
          {sessions.map((s) => <option key={s.session_key} value={s.session_key}>{s.session_key === f.liveKey ? "● LIVE — " : ""}{s.label}</option>)}
        </select>
        {f.isLive ? <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold">● LIVE</span> : (
          <>
            <button className="chip" onClick={() => f.setPlaying((p) => !p)}>{f.playing ? "❚❚ Pause" : "▶ Play"}</button>
            {SPEEDS.map((s) => <button key={s} className={`chip ${f.speed === s ? "chip-on" : ""}`} onClick={() => f.setSpeed(s)}>{s}×</button>)}
          </>
        )}
        {f.data && <span className={`rounded px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[f.data.status] ?? "bg-neutral-700"}`}>{f.data.status}</span>}
        <span className="font-mono text-sm">{fmtClock(f.elapsed)}</span>
        <button className={`chip ${f.autoRadio ? "chip-on" : ""}`} aria-pressed={f.autoRadio} onClick={() => f.setAutoRadio(!f.autoRadio)}
          title="New team radio always pops up bottom-right; with this on it also plays by itself">
          {f.autoRadio ? "🔊 Auto-play radio" : "🔇 Auto-play radio"}
        </button>
        {f.data?.weather && (
          <span className="muted text-xs">
            Air {f.data.weather.air_temperature.toFixed(1)}° · Track {f.data.weather.track_temperature.toFixed(1)}° · Hum {f.data.weather.humidity.toFixed(0)}% · Wind {f.data.weather.wind_speed.toFixed(1)} m/s
            {f.data.weather.rainfall ? <b className="text-blue-400"> · RAIN</b> : null}
          </span>
        )}
      </div>
      {slider && !f.isLive && f.session && (
        <input type="range" className="w-full accent-red-500" min={f.start} max={f.end} step={1000} value={f.replayT}
          onChange={(e) => f.seek(Number(e.target.value))} aria-label="Replay position" />
      )}
      {f.error && <p className="rounded border border-red-800 bg-red-950/50 p-2 text-sm text-red-300">{f.error}</p>}
    </div>
  );
}

export function Tower({ rows, selected, onSelect }: { rows: TowerRow[]; selected: number | null; onSelect: (n: number) => void }) {
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

/** Smoothly animated track map for the feed. */
export function FeedTrack({ f, height, showNames = false }: { f: LiveFeed; height: number | string; showNames?: boolean }) {
  return (
    <LiveTrack outline={f.circuit.outline} corners={f.circuit.corners} rotation={f.circuit.rotation} showNames={showNames} height={height}
      trails={f.data?.trails ?? {}}
      anchor={f.data ? { t: Date.parse(f.data.t), wall: f.data.sentAt } : null}
      rate={f.isLive ? 1 : f.playing ? f.speed : 0} lag={f.isLive ? 4000 : 0}
      cars={[...(f.data?.tower ?? [])].reverse().map((r) => ({ n: r.driver_number, label: r.acronym, colour: r.colour, highlight: r.driver_number === f.driver }))} />
  );
}

/** Selected driver's speed / throttle / brake over the last 40 s. */
export function DriverTelemetry({ f, height = 270 }: { f: LiveFeed; height?: number }) {
  const sel = f.data?.tower.find((r) => r.driver_number === f.driver);
  if (!sel || !f.data?.telemetry) return <p className="muted p-2 text-sm">Click a driver in the timing tower (or the running order) to see their telemetry.</p>;
  const t = f.data.telemetry;
  return (
    <div>
      <div className="text-xs font-semibold" style={{ color: sel.colour }}>{sel.acronym} · last 40 s</div>
      <TelemetryChart xLabel="s" xTitle="Time (s)" yTitle="Speed (km/h)" height={Math.round(height * 0.58)} lines={[{ name: "speed", colour: sel.colour, data: t.map((p) => ({ x: p.t, y: p.speed })) }]} />
      <TelemetryChart xLabel="s" xTitle="Time (s)" yTitle="Pedal (%)" height={Math.round(height * 0.42)} yDomain={[0, 100]} lines={[
        { name: "throttle", colour: "#22c55e", data: t.map((p) => ({ x: p.t, y: p.throttle })) },
        { name: "brake", colour: "#ef4444", data: t.map((p) => ({ x: p.t, y: p.brake })) },
      ]} />
    </div>
  );
}

export function RaceControlList({ f, className = "max-h-80" }: { f: LiveFeed; className?: string }) {
  return (
    <ul className={`space-y-1.5 overflow-y-auto text-sm ${className}`}>
      {f.data?.raceControl.map((m, i) => (
        <li key={i} className={/PENALTY|INVESTIGATION|NOTED|DELETED/.test(m.message) ? "text-amber-300" : m.flag === "RED" ? "text-red-400" : ""}>
          <span className="muted mr-2 font-mono text-xs"><LocalTime iso={m.date} withDay={false} />{m.lap_number ? ` · L${m.lap_number}` : ""}</span>{m.message}
        </li>
      ))}
      {f.data && f.data.raceControl.length === 0 && <li className="muted">No messages yet.</li>}
    </ul>
  );
}

export function RadioList({ f, className = "max-h-80" }: { f: LiveFeed; className?: string }) {
  return (
    <ul className={`space-y-2 overflow-y-auto text-sm ${className}`}>
      {f.data?.radio.map((r) => {
        const tr = f.transcripts[r.recording_url];
        return (
          <li key={r.recording_url} className="rounded-xl border border-neutral-800 bg-neutral-950 p-2">
            <div className="flex items-center gap-2">
              <span className="w-10 font-mono font-bold">{r.acronym}</span>
              <span className="muted w-12 font-mono text-xs"><LocalTime iso={r.date} withDay={false} /></span>
              <audio controls preload="none" src={r.recording_url} className="h-8 min-w-0 flex-1" />
            </div>
            <p className={`mt-1 pl-1 text-xs leading-snug ${tr?.startsWith("⚠") ? "text-red-400" : "text-neutral-300"}`}>
              {tr === undefined ? <span className="muted">Queued for transcript…</span>
                : tr === null ? <span className="muted animate-pulse">Transcribing…</span>
                : tr ? <>“{tr}”</> : <span className="muted">(no speech)</span>}
            </p>
          </li>
        );
      })}
      {f.data && f.data.radio.length === 0 && <li className="muted">No radio yet.</li>}
    </ul>
  );
}

/** Compact running order (used beside the full-size map and as a dashboard widget). */
export function RunningOrder({ f }: { f: LiveFeed }) {
  return (
    <ol className="space-y-1">
      {(f.data?.tower ?? []).map((r) => (
        <li key={r.driver_number}>
          <button onClick={() => f.toggleDriver(r.driver_number)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left font-mono text-sm hover:bg-neutral-800 ${r.driver_number === f.driver ? "bg-neutral-800 ring-1 ring-white/40" : ""}`}>
            <span className="w-5 text-right text-neutral-400">{r.out ? "–" : r.position ?? "–"}</span>
            <span className="h-4 w-1 rounded" style={{ background: r.colour }} />
            <b>{r.acronym}</b>
            {r.compound && <span className="h-2.5 w-2.5 rounded-full" style={{ background: compoundColour(r.compound) }} title={r.compound} />}
            <span className="ml-auto text-xs text-neutral-400">{r.out ? "OUT" : r.position === 1 ? "Leader" : r.gap ?? ""}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
