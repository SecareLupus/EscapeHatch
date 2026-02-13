import { AppShell } from "../components/app-shell";
import { discordLoginUrl, fetchViewerSession } from "../lib/control-plane";

export default async function HomePage() {
  const viewer = await fetchViewerSession();
  return <AppShell viewer={viewer} loginUrl={discordLoginUrl()} />;
}
