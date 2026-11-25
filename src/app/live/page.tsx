import { LiveView } from "@/components/LiveDashboard";
import { liveSessions } from "@/lib/live-sessions";

export const metadata = { title: "Live timing" };
export const revalidate = 60;

export default async function Live({ searchParams }: { searchParams: Promise<{ layout?: string }> }) {
  const [{ options, liveKey, next }, { layout }] = await Promise.all([liveSessions(), searchParams]);
  const initialLayout = layout === "canvas" || layout === "classic" ? layout : undefined;
  return <LiveView sessions={options} liveKey={liveKey} next={next} initialLayout={initialLayout} />;
}
