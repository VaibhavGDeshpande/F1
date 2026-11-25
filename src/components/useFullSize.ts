"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Full-size view for a panel: a full-window overlay (works everywhere, incl. iPhone) plus real browser full screen where
 * allowed. Esc closes it. Put `ref` on the panel and switch its classes on `full`.
 */
export function useFullSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    const onExit = () => !document.fullscreenElement && setFull(false); // browser Esc leaves full screen first
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onExit);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onExit); };
  }, [full]);
  const toggle = () => {
    if (full) {
      setFull(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } else {
      setFull(true);
      ref.current?.requestFullscreen?.().catch(() => {}); // refused (iframe, iOS): the overlay still fills the window
    }
  };
  return { ref, full, toggle };
}
