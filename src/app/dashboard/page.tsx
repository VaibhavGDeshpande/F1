import { TelemetryDashboard } from "@/components/TelemetryDashboard";
import { liveSessions } from "@/lib/live-sessions";

export const metadata = { title: "Telemetry dashboard" };

export default async function Dashboard() {
  const { options, liveKey } = await liveSessions();
  return <TelemetryDashboard sessions={options} liveKey={liveKey} />;
}
