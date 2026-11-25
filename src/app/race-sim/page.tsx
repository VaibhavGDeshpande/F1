import { RaceSim } from "@/components/RaceSim";
import { openf1, type Meeting } from "@/lib/openf1";
import { simDefaults } from "@/lib/racesim-data";

export const metadata = { title: "Race simulator" };

export default async function RaceSimPage({ searchParams }: { searchParams: Promise<{ meeting?: string }> }) {
  const { meeting } = await searchParams;
  const year = new Date().getUTCFullYear();
  const meetings = (await openf1<Meeting>("meetings", { year }, 3600))
    .filter((m) => !/testing/i.test(m.meeting_name))
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  // default: this weekend / the next race (a meeting stays "current" until 3 days after it starts)
  const chosen = meetings.find((m) => String(m.meeting_key) === meeting)
    ?? meetings.find((m) => Date.parse(m.date_start) > Date.now() - 3 * 86400_000) ?? meetings.at(-1);
  if (!chosen) return <p className="muted">No races this season yet.</p>;
  const defaults = await simDefaults(chosen);

  return (
    <RaceSim key={chosen.meeting_key} defaults={defaults} meetingKey={chosen.meeting_key} title={`${chosen.meeting_name} ${chosen.year}`}
      meetings={meetings.map((m) => ({ key: m.meeting_key, name: m.meeting_name }))} />
  );
}
