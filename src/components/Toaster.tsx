"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type Toast = { id: string; title: string; body: string; tone: "red" | "amber" | "purple" | "info"; href?: string; audio?: string };

const listeners = new Set<(t: Toast) => void>();
/** Show a toast from anywhere on the client. Toasts with an id already on screen are ignored. */
export const toast = (t: Toast) => listeners.forEach((l) => l(t));

const TONE = { red: "border-red-600", amber: "border-amber-500", purple: "border-purple-500", info: "border-sky-500" };
const TITLE = { red: "text-red-400", amber: "text-amber-300", purple: "text-purple-300", info: "text-sky-300" };

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((xs) => (xs.some((x) => x.id === t.id) ? xs : [...xs.slice(-3), t]));
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.audio ? 30_000 : 12_000); // time to press play
    };
    listeners.add(add);
    return () => void listeners.delete(add);
  }, []);

  // in browser full screen only the full-screen element is drawn, so the toasts have to live inside it
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    const on = () => setHost(document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const list = (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={`rounded-xl border-l-4 ${TONE[t.tone]} bg-neutral-900 p-3 text-sm shadow-2xl ring-1 ring-neutral-800`}>
          <div className="flex items-start gap-2">
            <span className={`text-xs font-bold uppercase ${TITLE[t.tone]}`}>{t.title}</span>
            <button aria-label="Dismiss" className="ml-auto text-neutral-500 hover:text-white" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
          <p className="mt-1 leading-snug">{t.body}</p>
          {t.audio && <audio controls preload="none" src={t.audio} className="mt-2 h-8 w-full" />}
          {t.href && <a href={t.href} target="_blank" rel="noreferrer" className="link mt-1 inline-block text-xs">Open document →</a>}
        </div>
      ))}
    </div>
  );
  return host ? createPortal(list, host) : list;
}
