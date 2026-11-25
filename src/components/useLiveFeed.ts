"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Corner, LiveState } from "@/lib/live";
import { liveEvents, type Snap } from "@/lib/live-events";
import { toast } from "./Toaster";

export type SessionOption = { session_key: number; label: string; date_start: string; date_end: string };
export type LiveData = LiveState & { sentAt: number };
export type Circuit = { outline: { x: number; y: number }[]; corners: Corner[]; rotation: number };

export const SPEEDS = [1, 4, 16]; // faster replays outrun OpenF1's free-tier request budget
export const STATUS_STYLE: Record<string, string> = {
  GREEN: "bg-green-600", "SAFETY CAR": "bg-yellow-500 text-black", VSC: "bg-yellow-500 text-black",
  "SC ENDING": "bg-yellow-300 text-black", "RED FLAG": "bg-red-600", CHEQUERED: "bg-neutral-200 text-black",
};
export const fmtClock = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const NO_CIRCUIT: Circuit = { outline: [], corners: [], rotation: 0 };

/**
 * Everything the live/replay views share: session choice, replay clock, polling /api/live, circuit data, toasts and
 * radio transcripts. Live = poll every 4 s; replay = advance the clock by speed × 2 s every 2 s.
 */
export function useLiveFeed(sessions: SessionOption[], liveKey: number | null) {
  const [key, setKey] = useState<number | null>(liveKey ?? sessions[0]?.session_key ?? null);
  const session = sessions.find((s) => s.session_key === key) ?? null;
  const isLive = key != null && key === liveKey;
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [driver, setDriver] = useState<number | null>(null);
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [circuit, setCircuit] = useState<Circuit>(NO_CIRCUIT);
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

  // new session → reset the replay clock to the start and load the circuit
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

  const start = session ? Date.parse(session.date_start) : 0, end = session ? Date.parse(session.date_end) : 0;
  return {
    key, setKey, session, isLive, liveKey, playing, setPlaying, speed, setSpeed, data, error, circuit, transcripts,
    driver, setDriver, toggleDriver: (n: number) => setDriver((d) => (d === n ? null : n)),
    replayT, start, end, elapsed: Math.max(0, (data ? Date.parse(data.t) : replayT) - start) / 1000,
    seek: (t: number) => { tRef.current = t; setReplayT(t); load(); },
  };
}
export type LiveFeed = ReturnType<typeof useLiveFeed>;
