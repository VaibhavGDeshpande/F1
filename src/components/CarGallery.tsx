"use client";
import { useState } from "react";
import { Box, ExternalLink, Heart, Play } from "lucide-react";
import { teamCar, teamLogo } from "@/lib/media";
import type { CarModel } from "@/lib/sketchfab";
import { Img } from "./Img";

export type GalleryTeam = { slug: string; name: string; colour: string; models: CarModel[]; modelYear: number | null };

/** Cover for a model whose Sketchfab thumbnail isn't ready yet: the team's official car render on its colours. */
function Cover({ team, big = false }: { team: GalleryTeam; big?: boolean }) {
  return (
    <div className="grid h-full w-full place-items-center" style={{ background: `radial-gradient(circle at 50% 60%, ${team.colour}55, #0b0b0d 70%)` }}>
      <Img src={teamCar(team.name, big ? 400 : 200)} alt={`${team.name} car`} className={`${big ? "w-3/4" : "w-5/6"} object-contain drop-shadow-2xl`} />
    </div>
  );
}

/** One big Sketchfab viewer (click to load; models are tens of MB) plus a team picker. */
export function CarGallery({ teams, year, initial }: { teams: GalleryTeam[]; year: number; initial?: string }) {
  const [slug, setSlug] = useState(teams.find((t) => t.slug === initial)?.slug ?? teams.find((t) => t.models.length)?.slug ?? teams[0]?.slug);
  const [pick, setPick] = useState(0);
  const [loaded, setLoaded] = useState<string | null>(null); // uid of the model whose 3D viewer is running
  const team = teams.find((t) => t.slug === slug);
  const model = team?.models[pick] ?? team?.models[0];

  const choose = (s: string) => {
    setSlug(s); setPick(0); setLoaded(null);
    window.history.replaceState(null, "", `/cars?team=${s}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1 flex items-center gap-3"><Box size={30} />{year} cars in 3D</h1>
        <p className="muted text-sm">Community-made models from Sketchfab, shown in Sketchfab&apos;s own viewer. Drag to spin, scroll to zoom. Fan models, not official CAD.</p>
      </div>

      {team && (
        <section className="card overflow-hidden p-0" style={{ background: `linear-gradient(160deg, ${team.colour}44, #111113 55%)` }}>
          <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
            <Img src={teamLogo(team.name, 64)} alt="" className="h-7 w-auto" />
            <span className="font-display text-3xl font-bold uppercase">{team.name}</span>
            {team.modelYear && team.modelYear !== year && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-300">No {year} model yet: showing the {team.modelYear} car</span>
            )}
          </div>

          <div className="relative m-4 aspect-video overflow-hidden rounded-xl border border-neutral-800 bg-black">
            {!model ? (
              <div className="muted grid h-full place-items-center text-sm">No 3D model of this car on Sketchfab yet.</div>
            ) : loaded === model.uid ? (
              <iframe key={model.uid} title={`${model.name} by ${model.author} on Sketchfab`} className="h-full w-full"
                src={`${model.embedUrl}?autostart=1&ui_theme=dark&dnt=1&preload=1`}
                allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen />
            ) : (
              <button onClick={() => setLoaded(model.uid)} className="group relative h-full w-full" aria-label={`Load 3D model: ${model.name}`}>
                {model.thumb ? <img src={model.thumb} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
                  : <Cover team={team} big />}
                <span className="absolute inset-0 grid place-items-center">
                  <span className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 font-semibold shadow-2xl transition group-hover:scale-105">
                    <Play size={18} />View in 3D
                  </span>
                </span>
              </button>
            )}
          </div>

          {model && (
            <div className="space-y-2 px-4 pb-4">
              {team.models.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {team.models.map((m, i) => (
                    <button key={m.uid} onClick={() => { setPick(i); setLoaded(null); }}
                      className={`pill flex items-center gap-1.5 ${m.uid === model.uid ? "pill-on" : ""}`}>
                      {m.name} <span className="opacity-70">· {m.author}</span> <Heart size={11} /> {m.likes}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-neutral-400">
                “{model.name}” by <a href={model.authorUrl} target="_blank" rel="noreferrer" className="link">{model.author}</a>
                {model.license && <> · licence: {model.license}</>}
                {" · "}<a href={model.viewerUrl} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">open on Sketchfab <ExternalLink size={11} /></a>
              </p>
            </div>
          )}
        </section>
      )}

      {/* auto-fill + min-w-0: cards shrink to fit instead of pushing the grid past the right edge */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {teams.map((t) => (
          <button key={t.slug} onClick={() => choose(t.slug)}
            className={`min-w-0 overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${t.slug === slug ? "border-white/60" : "border-neutral-800 hover:border-neutral-600"}`}
            style={{ background: `linear-gradient(160deg, ${t.colour}44, #111113 60%)` }}>
            <div className="flex items-center gap-2 px-3 pt-3">
              <Img src={teamLogo(t.name, 32)} alt="" className="h-4 w-auto" />
              <span className="font-semibold">{t.name}</span>
              <span className="ml-auto text-[11px] text-neutral-400">
                {t.models.length ? `${t.models.length} model${t.models.length > 1 ? "s" : ""}${t.modelYear !== year ? ` · ${t.modelYear}` : ""}` : "none yet"}
              </span>
            </div>
            <div className="mt-2 aspect-video bg-black/40">
              {t.models[0]?.thumb ? <img src={t.models[0].thumb} alt={`${t.name} model preview`} className="h-full w-full object-cover" loading="lazy" />
                : t.models.length ? <Cover team={t} /> : <div className="muted grid h-full place-items-center text-xs">No model</div>}
            </div>
            <span className="block h-1" style={{ background: t.colour }} />
          </button>
        ))}
      </div>
    </div>
  );
}
