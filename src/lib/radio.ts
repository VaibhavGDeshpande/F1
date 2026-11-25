// Team radio transcripts with a local Whisper model (no API key; runs on the server CPU).
// Each clip is transcribed once, one at a time, and cached in memory + on disk.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MODEL = "onnx-community/whisper-small.en"; // base.en is 2× faster but garbles noisy radio badly
const RADIO_URL = /^https:\/\/livetiming\.formula1\.com\/static\/[\w\-./]+\/TeamRadio\/[\w-]+\.mp3$/;
const CACHE_FILE = path.join(process.cwd(), ".next", "cache", "radio-transcripts.json");

export const isRadioUrl = (u: string) => RADIO_URL.test(u) && !u.includes("..");

type Asr = (audio: Float32Array) => Promise<{ text: string }>;
type RadioState = { cache: Map<string, string>; loaded: boolean; queue: Promise<unknown>; asr?: Promise<Asr> };
const g = globalThis as unknown as { __radio?: RadioState };
const state: RadioState = (g.__radio ??= { cache: new Map(), loaded: false, queue: Promise.resolve() });

/** Mono → 16 kHz by averaging each window (a cheap low-pass, better than dropping samples). */
export function to16k(x: Float32Array, rate: number): Float32Array {
  const ratio = rate / 16000, out = new Float32Array(Math.floor(x.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += x[j];
    out[i] = s / (b - a);
  }
  return out;
}

async function decodeMp3(buf: Uint8Array) {
  const { MPEGDecoder } = await import("mpg123-decoder");
  const dec = new MPEGDecoder();
  await dec.ready;
  try {
    const { channelData, sampleRate } = dec.decode(buf);
    return to16k(channelData[0], sampleRate);
  } finally {
    dec.free();
  }
}

const model = () =>
  (state.asr ??= import("@huggingface/transformers").then(
    async ({ pipeline }) => (await pipeline("automatic-speech-recognition", MODEL, { dtype: "q8" })) as unknown as Asr,
  ));

async function loadDiskCache() {
  if (state.loaded) return;
  state.loaded = true;
  try {
    for (const [k, v] of Object.entries(JSON.parse(await readFile(CACHE_FILE, "utf8")))) state.cache.set(k, String(v));
  } catch {
    // no cache file yet
  }
}

async function saveDiskCache() {
  try {
    await mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(Object.fromEntries(state.cache)));
  } catch (e) {
    console.warn("radio transcript cache not saved (read-only filesystem?)", e); // memory cache still works
  }
}

export async function transcribe(url: string): Promise<string> {
  await loadDiskCache();
  const hit = state.cache.get(url);
  if (hit != null) return hit;
  // one clip at a time: Whisper is CPU-bound and parallel runs only slow each other down
  const job = state.queue.then(async () => {
    const again = state.cache.get(url);
    if (again != null) return again;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`radio clip unavailable (${res.status})`);
    const audio = await decodeMp3(new Uint8Array(await res.arrayBuffer()));
    const text = (await (await model())(audio)).text.trim();
    state.cache.set(url, text);
    await saveDiskCache();
    return text;
  });
  state.queue = job.catch(() => {});
  return job;
}
