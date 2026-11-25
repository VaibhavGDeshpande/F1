"use client";
import { useEffect, useState } from "react";

/** Renders a timestamp in the viewer's own timezone. */
export function LocalTime({ iso, withDay = true }: { iso: string; withDay?: boolean }) {
  const opts: Intl.DateTimeFormatOptions = withDay
    ? { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" };
  return <span suppressHydrationWarning>{new Date(iso).toLocaleString(undefined, opts)}</span>;
}

/** Live countdown to a timestamp. */
export function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return <span>…</span>;
  const s = Math.max(0, Math.floor((Date.parse(iso) - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (
    <span className="font-mono tabular-nums">
      {d > 0 && `${d}d `}{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}
