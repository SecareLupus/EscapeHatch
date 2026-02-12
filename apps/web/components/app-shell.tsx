const creatorServers = ["Creator HQ", "Art Guild", "Mod Room"];
const channels = ["#announcements", "#general", "#voice-lounge"];

export function AppShell() {
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
        <p>
          This shell gives us a Discord-style layout to begin integrating Matrix timelines,
          role-aware moderation controls, and SFU voice presence.
        </p>
      </section>
    </main>
  );
}
