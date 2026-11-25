"use client";
import { useSyncExternalStore } from "react";
import { GraduationCap } from "lucide-react";

// Learn mode: one switch in the header shows plain-English explainers next to every chart. Remembered per browser.
const KEY = "pitwall:learn", EVT = "pitwall:learn";
let memory = false; // used when storage is blocked, so the switch still works for this visit

const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return memory; } };
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
};
export const useLearn = () => useSyncExternalStore(subscribe, read, () => false);
const setLearn = (on: boolean) => {
  memory = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* storage blocked: memory only */ }
  window.dispatchEvent(new Event(EVT));
};

export function LearnToggle() {
  const on = useLearn();
  return (
    <button aria-pressed={on} onClick={() => setLearn(!on)} title="Show explanations next to every chart"
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? "border-sky-400 bg-sky-500/20 text-sky-200" : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"}`}>
      <GraduationCap size={14} />Learn mode{on ? " on" : ""}
    </button>
  );
}

/** Explainer box, only visible in Learn mode. `look` = what to look for, `children` = what it means. */
export function Learn({ title, look, children, className = "" }: { title?: string; look?: React.ReactNode; children: React.ReactNode; className?: string }) {
  if (!useLearn()) return null;
  return (
    <div className={`rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs leading-relaxed text-sky-50 ${className}`}>
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-sky-300"><GraduationCap size={13} />{title ?? "How to read this"}</div>
      <div>{children}</div>
      {look && <div className="mt-1.5 text-sky-200"><b>Try this:</b> {look}</div>}
    </div>
  );
}
