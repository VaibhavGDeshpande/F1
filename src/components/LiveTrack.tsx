"use client";
import { useEffect, useState } from "react";
import { trailAt } from "@/lib/analysis";
import type { Trail } from "@/lib/live";
import { TrackMap } from "./TrackMap";

/**
 * Track map that moves every car smoothly at the screen's frame rate by interpolating between position samples.
 * Display time = anchor.t − lag + (time since the anchor's request was sent) × rate.
 * Live: rate 1 with a lag, so there is always a newer sample to move towards. Replay: rate = playback speed (0 when paused).
 */
export function LiveTrack({ outline, corners, rotation, showNames, trails, cars, anchor, rate, lag = 0, height = 340 }: {
  outline: { x: number; y: number }[];
  corners?: { n: number; letter?: string; x: number; y: number; angle: number; name?: string }[];
  showNames?: boolean;
  rotation?: number;
  trails: Record<number, Trail>;
  cars: { n: number; label: string; colour: string; highlight?: boolean }[];
  anchor: { t: number; wall: number } | null;
  rate: number; lag?: number; height?: number | string;
}) {
  const [, frame] = useState(0);
  useEffect(() => {
    if (!rate) return; // paused: no need to redraw
    let id = 0;
    const tick = () => { frame((x) => (x + 1) % 1e6); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [rate]);

  const at = anchor ? anchor.t - lag + (performance.now() - anchor.wall) * rate : 0;
  const placed = anchor
    ? cars.flatMap((c) => {
        const p = trails[c.n] && trailAt(trails[c.n], at);
        return p ? [{ ...p, label: c.label, colour: c.colour, highlight: c.highlight }] : [];
      })
    : [];
  return <TrackMap outline={outline} corners={corners} rotation={rotation} showNames={showNames} cars={placed} height={height} />;
}
