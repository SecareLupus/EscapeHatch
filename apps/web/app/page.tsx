import { AppShell } from "../components/app-shell";
import { discordLoginUrl, fetchModerationSummary, fetchViewerSession } from "../lib/control-plane";

export default async function HomePage() {
  const viewer = await fetchViewerSession();
  const moderationSummary = viewer ? await fetchModerationSummary("dev-server") : null;

  return <AppShell viewer={viewer} loginUrl={discordLoginUrl()} moderationSummary={moderationSummary} />;
}
