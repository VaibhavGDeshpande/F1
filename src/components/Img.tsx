"use client";
import { useState } from "react";

/** <img> that disappears (or shows a fallback) if the remote image fails, e.g. a missing team logo. */
export function Img({ src, alt, className, fallback = null }: { src: string | null | undefined; alt: string; className?: string; fallback?: React.ReactNode }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setBad(true)} />;
}
