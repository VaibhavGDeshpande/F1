"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Corner, LiveState } from "@/lib/live";
import { liveEvents, type Snap } from "@/lib/live-events";
import { toast } from "./Toaster";

export type SessionOption = { session_key: number; label: string; date_start: string; date_end: string };
export type LiveData = LiveState & { sentAt: number };
export type Circuit = { outline: { x: number; y: number }[]; corners: Corner[]; rotation: number; lat?: number; lon?: number };

export const SPEEDS = [1, 4, 16]; // faster replays outrun OpenF1's free-tier request budget
export const STATUS_STYLE: Record<string, string> = {
  GREEN: "bg-green-600", "SAFETY CAR": "bg-yellow-500 text-black", VSC: "bg-yellow-500 text-black",
  "SC ENDING": "bg-yellow-300 text-black", "RED FLAG": "bg-red-600", CHEQUERED: "bg-neutral-200 text-black",
};
export const fmtClock = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const NO_CIRCUIT: Circuit = { outline: [], corners: [], rotation: 0 };

// sound before an auto-played radio message: your own clip at public/sounds/radio.mp3 if it exists, else a synthesised beep
const RADIO_SOUND = "/sounds/radio.mp3";
let noRadioFile = false;
function radioBeep(): Promise<void> {
  if (noRadioFile) return synthBeep();
  const clip = new Audio(RADIO_SOUND);
  return new Promise<void>((resolve, reject) => {
    clip.onended = () => resolve();
    clip.onerror = () => { noRadioFile = true; synthBeep().then(resolve); }; // missing file: don't ask again
    clip.play().catch((e) => (e?.name === "NotAllowedError" ? reject(e) : undefined)); // load errors go to onerror
  });
}

// "incoming radio" double beep, synthesised; resolves when it has finished
let beepCtx: AudioContext | null = null;
function synthBeep(): Promise<void> {
  try {
    const ctx = (beepCtx ??= new AudioContext());
    const t0 = ctx.currentTime + 0.02;
    [[0, 1250], [0.13, 1650]].forEach(([at, hz]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0, t0 + at);
      gain.gain.linearRampToValueAtTime(0.08, t0 + at + 0.005);
      gain.gain.setValueAtTime(0.08, t0 + at + 0.09);
      gain.gain.linearRampToValueAtTime(0, t0 + at + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.11);
    });
    return ctx.resume().then(() => new Promise((r) => setTimeout(r, 380)));
  } catch {
    return Promise.resolve(); // no Web Audio: just play the message
  }
}

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

  // team radio: toast each new message; with auto-play on, play them one after another instead
  const [autoRadio, setAutoRadioState] = useState(false);
  const autoRef = useRef(false), seenRadio = useRef<Set<string> | null>(null);
  const queue = useRef<string[]>([]), player = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    try { autoRef.current = localStorage.getItem("pitwall:auto-radio") === "1"; setAutoRadioState(autoRef.current); } catch { /* storage blocked */ }
    return () => player.current?.pause();
  }, []);
  const setAutoRadio = (v: boolean) => {
    autoRef.current = v;
    setAutoRadioState(v);
    try { localStorage.setItem("pitwall:auto-radio", v ? "1" : "0"); } catch { /* not saved */ }
    if (!v) { queue.current = []; player.current?.pause(); }
  };
  const playNext = () => {
    const url = queue.current.shift();
    if (!url || !autoRef.current) return;
    const a = (player.current ??= new Audio());
    a.src = url;
    a.onended = playNext;
    radioBeep().then(() => (autoRef.current ? a.play() : undefined)).catch(() => toast({ id: "radio-blocked", tone: "amber", title: "Team radio", body: "The browser blocked auto-play. Click anywhere on the page and the next message will play." }));
  };
  useEffect(() => {
    if (!data) { seenRadio.current = null; return; }
    const seen = seenRadio.current;
    seenRadio.current = new Set(data.radio.map((r) => r.recording_url));
    if (!seen) return; // first load / after a seek: don't replay the whole backlog
    const fresh = data.radio.filter((r) => !seen.has(r.recording_url)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(-2);
    for (const r of fresh) {
      const auto = autoRef.current;
      toast({ id: r.recording_url, tone: "info", title: `Team radio · ${r.acronym}`, body: auto ? "Playing now…" : "New message. Press play to listen.", audio: auto ? undefined : r.recording_url });
      if (auto) {
        queue.current = [...queue.current, r.recording_url].slice(-3);
        if (!player.current || player.current.paused || player.current.ended) playNext();
      }
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

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
      .then((j) => setCircuit({ outline: j.outline ?? [], corners: j.corners ?? [], rotation: j.rotation ?? 0, lat: j.lat, lon: j.lon })).catch(() => {});
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
    autoRadio, setAutoRadio, driver, setDriver, toggleDriver: (n: number) => setDriver((d) => (d === n ? null : n)),
    replayT, start, end, elapsed: Math.max(0, (data ? Date.parse(data.t) : replayT) - start) / 1000,
    seek: (t: number) => { tRef.current = t; setReplayT(t); seenRadio.current = null; load(); },
  };
}
export type LiveFeed = ReturnType<typeof useLiveFeed>;
