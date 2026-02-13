import Link from "next/link";
import type { ModerationDashboardSummary, ViewerSession } from "../lib/control-plane";

const creatorServers = ["Creator HQ", "Art Guild", "Mod Room"];
const channels = ["#announcements", "#general", "#voice-lounge"];

interface AppShellProps {
  viewer: ViewerSession | null;
  loginUrl: string;
  moderationSummary: ModerationDashboardSummary | null;
}

export function AppShell({ viewer, loginUrl, moderationSummary }: AppShellProps) {
  const username = viewer?.identity?.preferredUsername ?? "Guest";

  return (
    <main className="shell">
      <aside className="server-rail">
        <h2>Servers</h2>
        <ul>
          {creatorServers.map((server) => (
            <li key={server}>{server}</li>
          ))}
        </ul>
      </aside>
      <aside className="channel-rail">
        <h2>Channels</h2>
        <ul>
          {channels.map((channel) => (
            <li key={channel}>{channel}</li>
          ))}
        </ul>
      </aside>
      <section className="timeline">
        <h1>EscapeHatch Creator Hub Console</h1>
        <p>Signed in as: {username}</p>
        {!viewer ? (
          <Link href={loginUrl}>Sign in with Discord</Link>
        ) : (
          <>
            <p>Session established with control-plane identity mapping.</p>
            <h2>Moderation Toolkit</h2>
            <p>Open reports: {moderationSummary?.queueCount ?? "n/a"}</p>
            <ul>
              {(moderationSummary?.latestActions ?? []).map((item) => (
                <li key={item.id}>
                  {item.actionType}: {item.reason}
                </li>
              ))}
            </ul>
            <h2>Voice Channel Foundation</h2>
            <p>Voice channels are now bound to SFU rooms and scoped token issuance APIs.</p>
            <button type="button">Join Voice Lounge</button>
          </>
        )}
      </section>
    </main>
  );
}
