// Current drivers with standings, numbers, team colours and images (Jolpica standings + OpenF1 latest session).
import { driverStandings } from "./jolpica";
import { driverPortrait, driverRef, refFromHeadshot, teamLogo, teamSlug } from "./media";
import { openf1, teamColour, type Driver } from "./openf1";

export type RosterDriver = {
  id: string; code: string; number: string; given: string; family: string; nationality: string;
  team: string; colour: string; portrait: string | null; headshot: string | null; logo: string | null;
  position: string; points: string; wins: string;
  active: boolean; // drove in the latest session (false = replaced / left mid-season)
};

export async function roster(): Promise<RosterDriver[]> {
  const [standings, latest] = await Promise.all([
    driverStandings(),
    openf1<Driver>("drivers", { session_key: "latest" }, 900).catch(() => [] as Driver[]),
  ]);
  return standings.map((s) => {
    const d = latest.find((x) => x.name_acronym === s.Driver.code);
    const team = d?.team_name ?? s.Constructors.at(-1)?.name ?? "";
    const ref = refFromHeadshot(d?.headshot_url) ?? driverRef(s.Driver.givenName, s.Driver.familyName);
    return {
      id: s.Driver.driverId, code: s.Driver.code ?? s.Driver.familyName.slice(0, 3).toUpperCase(),
      number: String(d?.driver_number ?? s.Driver.permanentNumber ?? ""),
      given: s.Driver.givenName, family: s.Driver.familyName, nationality: s.Driver.nationality,
      team, colour: d ? teamColour(d) : colourOfTeam(latest, team),
      portrait: driverPortrait(team, ref), headshot: d?.headshot_url ?? null, logo: teamLogo(team),
      position: s.positionText, points: s.points, wins: s.wins,
      active: !!d || latest.length === 0,
    };
  });
}

/** Team colour from OpenF1's latest drivers, matched by team slug (works for Jolpica constructor names too). */
export function colourOfTeam(latest: Pick<Driver, "team_name" | "team_colour">[], team: string) {
  const d = latest.find((x) => teamSlug(x.team_name) === teamSlug(team));
  return d ? teamColour(d) : "#888888";
}
