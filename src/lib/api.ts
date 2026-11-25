import { NextResponse } from "next/server";
import { OpenF1Error } from "./openf1";

export const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export function fail(e: unknown) {
  console.error(e);
  const needsAuth = e instanceof OpenF1Error && (e.status === 401 || e.status === 403);
  const error = needsAuth
    ? `OpenF1 needs a paid account for data during a live session (${e.message}). Set OPENF1_USERNAME / OPENF1_PASSWORD, or use replay.`
    : e instanceof Error ? e.message : "Upstream error";
  return NextResponse.json({ error, needsAuth }, { status: needsAuth ? 503 : 502 });
}
