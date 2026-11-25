import { CarGallery, type GalleryTeam } from "@/components/CarGallery";
import { constructorStandings } from "@/lib/jolpica";
import { teamSlug } from "@/lib/media";
import { roster } from "@/lib/roster";
import { teamModels } from "@/lib/sketchfab";

export const metadata = { title: "3D cars" };

export default async function Cars({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const { team } = await searchParams;
  const year = new Date().getUTCFullYear();
  const [teams, drivers] = await Promise.all([constructorStandings(), roster().catch(() => [])]);
  const list: GalleryTeam[] = await Promise.all(teams.map(async (t) => {
    const slug = teamSlug(t.Constructor.name) ?? t.Constructor.constructorId;
    const found = await teamModels(t.Constructor.name, year).catch((e) => { console.error("sketchfab", e); return { models: [], year: null }; });
    return {
      slug, name: t.Constructor.name, colour: drivers.find((d) => teamSlug(d.team) === slug)?.colour ?? "#888888",
      models: found.models, modelYear: found.year,
    };
  }));
  return <CarGallery teams={list} year={year} initial={team} />;
}
