import { LiveDashboard } from "@/components/LiveDashboard";
import { liveSessions } from "@/lib/live-sessions";

export const metadata = { title: "Live timing" };
export const revalidate = 60;

export default async function Live() {
  const { options, liveKey, next } = await liveSessions();
  return <LiveDashboard sessions={options} liveKey={liveKey} next={next} />;
}
