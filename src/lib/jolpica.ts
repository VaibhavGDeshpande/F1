// Jolpica-F1 (Ergast successor): results, standings, driver/constructor info back to 1950.
const BASE = "https://api.jolpi.ca/ergast/f1";

export type JDriver = {
  driverId: string; permanentNumber?: string; code?: string; givenName: string; familyName: string;
  nationality: string; dateOfBirth: string; url: string;
};
export type JConstructor = { constructorId: string; name: string; nationality: string; url: string };
export type DriverStanding = { position?: string; positionText: string; points: string; wins: string; Driver: JDriver; Constructors: JConstructor[] };
export type ConstructorStanding = { position?: string; positionText: string; points: string; wins: string; Constructor: JConstructor };
export type Result = {
  number: string; position: string; positionText: string; points: string; grid: string; laps: string; status: string;
  Driver: JDriver; Constructor: JConstructor; Time?: { time: string }; FastestLap?: { rank: string; Time: { time: string } };
};
export type Race = { season: string; round: string; raceName: string; date: string; Circuit: { circuitName: string }; Results?: Result[] };

async function jolpica(path: string, revalidate = 900) {
  // Jolpica answers 403 to requests without a User-Agent (Node's fetch sends none by default)
  const res = await fetch(`${BASE}/${path}`, { headers: { "User-Agent": "f1-site/0.1" }, next: { revalidate } });
  if (!res.ok) throw new Error(`Jolpica ${res.status} for ${path}`);
  return (await res.json()).MRData;
}

export const SAFE_ID = /^[a-z0-9_]+$/;
export const SAFE_SEASON = /^(current|\d{4})$/;

export async function driverStandings(season = "current"): Promise<DriverStanding[]> {
  const d = await jolpica(`${season}/driverstandings/?limit=100`);
  return d.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
}

export async function constructorStandings(season = "current"): Promise<ConstructorStanding[]> {
  const d = await jolpica(`${season}/constructorstandings/?limit=100`);
  return d.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [];
}

export type ScheduleRace = {
  round: string; raceName: string; date: string;
  Circuit: { circuitId: string; circuitName: string; Location: { lat: string; long: string; locality: string } };
};

export async function seasonSchedule(year: number): Promise<ScheduleRace[]> {
  return (await jolpica(`${year}/races/?limit=40`, 86400)).RaceTable.Races;
}

/** A season's race result at one circuit (null if no race there that year). */
export async function circuitRace(year: number, circuitId: string): Promise<Race | null> {
  return (await jolpica(`${year}/circuits/${circuitId}/results/?limit=40`, 86400)).RaceTable.Races[0] ?? null;
}

/** Constructors' standings after a given round. */
export async function constructorStandingsAfter(year: number, round: number): Promise<ConstructorStanding[]> {
  const d = await jolpica(`${year}/${round}/constructorstandings/?limit=40`);
  return d.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [];
}

export async function lastRaceResults(): Promise<Race | null> {
  const d = await jolpica("current/last/results/?limit=30", 600);
  return d.RaceTable.Races[0] ?? null;
}

export async function driverInfo(driverId: string): Promise<JDriver | null> {
  const d = await jolpica(`drivers/${driverId}/`, 86400);
  return d.DriverTable.Drivers[0] ?? null;
}

export async function constructorInfo(constructorId: string): Promise<JConstructor | null> {
  const d = await jolpica(`constructors/${constructorId}/`, 86400);
  return d.ConstructorTable.Constructors[0] ?? null;
}

export async function driverResults(driverId: string, season = "current"): Promise<Race[]> {
  const d = await jolpica(`${season}/drivers/${driverId}/results/?limit=100`);
  return d.RaceTable.Races;
}

export async function constructorResults(constructorId: string, season = "current"): Promise<Race[]> {
  const d = await jolpica(`${season}/constructors/${constructorId}/results/?limit=100`);
  return d.RaceTable.Races;
}
