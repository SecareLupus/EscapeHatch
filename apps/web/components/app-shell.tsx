import Link from "next/link";
import type { ViewerSession } from "../lib/control-plane";

const creatorServers = ["Creator HQ", "Art Guild", "Mod Room"];
const channels = ["#announcements", "#general", "#voice-lounge"];

interface AppShellProps {
  viewer: ViewerSession | null;
  loginUrl: string;
}

export function AppShell({ viewer, loginUrl }: AppShellProps) {
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
        <h1>EscapeHatch Boilerplate Ready</h1>
        <p>Signed in as: {username}</p>
        {!viewer ? (
          <Link href={loginUrl}>Sign in with Discord</Link>
        ) : (
          <p>Session established with control-plane identity mapping.</p>
        )}
      </section>
    </main>
  );
}
