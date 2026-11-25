import { redirect } from "next/navigation";

// the canvas dashboard is now a layout of the Live page; keep old links and bookmarks working
export default function Dashboard() {
  redirect("/live?layout=canvas");
}
