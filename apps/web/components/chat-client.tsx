"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Channel, ChatMessage, Server } from "@escapehatch/shared";
import {
  bootstrapAdmin,
  fetchAuthProviders,
  fetchBootstrapStatus,
  fetchViewerSession,
  listChannels,
  listMessages,
  listServers,
  logout,
  providerLoginUrl,
  sendMessage,
  type AuthProvidersResponse,
  type BootstrapStatus,
  type ViewerSession
} from "../lib/control-plane";

function formatMessageTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatClient() {
  const [viewer, setViewer] = useState<ViewerSession | null>(null);
  const [providers, setProviders] = useState<AuthProvidersResponse | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupToken, setSetupToken] = useState("");
  const [hubName, setHubName] = useState("Local Creator Hub");
  const [draftMessage, setDraftMessage] = useState("");
  const [devUsername, setDevUsername] = useState("local-admin");
  const [sending, setSending] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  const activeProvider = useMemo(() => providers?.primaryProvider ?? "discord", [providers]);
  const activeChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null;

  async function refreshAuthState(): Promise<void> {
    const [providerData, viewerData, bootstrapData] = await Promise.all([
      fetchAuthProviders(),
      fetchViewerSession(),
      fetchBootstrapStatus()
    ]);

    setProviders(providerData);
    setViewer(viewerData);
    setBootstrapStatus(bootstrapData);
  }

  async function refreshChatState(preferredServerId?: string, preferredChannelId?: string): Promise<void> {
    const serverItems = await listServers();
    setServers(serverItems);

    const nextServerId = preferredServerId ?? selectedServerId ?? serverItems[0]?.id ?? null;
    setSelectedServerId(nextServerId);

    if (!nextServerId) {
      setChannels([]);
      setSelectedChannelId(null);
      setMessages([]);
      return;
    }

    const channelItems = await listChannels(nextServerId);
    setChannels(channelItems);

    const textChannels = channelItems.filter((channel) => channel.type === "text" || channel.type === "announcement");
    const nextChannelId =
      preferredChannelId ?? selectedChannelId ?? textChannels[0]?.id ?? channelItems[0]?.id ?? null;
    setSelectedChannelId(nextChannelId);

    if (!nextChannelId) {
      setMessages([]);
      return;
    }

    const messageItems = await listMessages(nextChannelId);
    setMessages(messageItems);
  }

  async function initialize(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await refreshAuthState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load auth state.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    if (!viewer || !bootstrapStatus?.initialized) {
      return;
    }

    void refreshChatState(bootstrapStatus.defaultServerId ?? undefined, bootstrapStatus.defaultChannelId ?? undefined).catch(
      (cause) => {
        setError(cause instanceof Error ? cause.message : "Failed to load chat state.");
      }
    );
  }, [viewer, bootstrapStatus?.initialized, bootstrapStatus?.defaultServerId, bootstrapStatus?.defaultChannelId]);

  useEffect(() => {
    if (!viewer || !bootstrapStatus?.initialized || !selectedChannelId) {
      return;
    }

    const interval = setInterval(() => {
      void listMessages(selectedChannelId)
        .then(setMessages)
        .catch(() => {
          // Keep previous messages on transient polling failures.
        });
    }, 3000);

    return () => clearInterval(interval);
  }, [viewer, bootstrapStatus?.initialized, selectedChannelId]);

  async function handleServerChange(serverId: string): Promise<void> {
    setSelectedServerId(serverId);
    setError(null);
    try {
      await refreshChatState(serverId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load channels.");
    }
  }

  async function handleChannelChange(channelId: string): Promise<void> {
    setSelectedChannelId(channelId);
    setError(null);
    try {
      setMessages(await listMessages(channelId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load messages.");
    }
  }

  async function handleBootstrap(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBootstrapping(true);
    setError(null);
    try {
      const result = await bootstrapAdmin({ setupToken, hubName });
      setSetupToken("");
      await refreshAuthState();
      await refreshChatState(result.defaultServerId, result.defaultChannelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bootstrap failed.");
    } finally {
      setBootstrapping(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedChannelId || !draftMessage.trim()) {
      return;
    }

    setSending(true);
    setError(null);
    try {
      await sendMessage(selectedChannelId, draftMessage.trim());
      setDraftMessage("");
      setMessages(await listMessages(selectedChannelId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message send failed.");
    } finally {
      setSending(false);
    }
  }

  async function handleLogout(): Promise<void> {
    setError(null);
    try {
      await logout();
      setViewer(null);
      setServers([]);
      setChannels([]);
      setMessages([]);
      await initialize();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Logout failed.");
    }
  }

  if (loading) {
    return (
      <main className="app">
        <section className="panel">
          <h1>EscapeHatch</h1>
          <p>Loading local workspace...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="topbar">
        <h1>EscapeHatch Local Chat</h1>
        <div className="topbar-meta">
          <span aria-live="polite">
            Signed in as {viewer?.identity?.preferredUsername ?? "Guest"}
          </span>
          {viewer ? (
            <button type="button" className="ghost" onClick={handleLogout}>
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {!viewer ? (
        <section className="panel">
          <h2>Sign In</h2>
          <p>Use developer login for local testing, or configured OAuth providers.</p>
          {activeProvider === "dev" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                window.location.href = providerLoginUrl("dev", devUsername);
              }}
              className="stack"
            >
              <label htmlFor="dev-username">Developer Username</label>
              <input
                id="dev-username"
                value={devUsername}
                onChange={(event) => setDevUsername(event.target.value)}
                minLength={3}
                maxLength={40}
                required
              />
              <button type="submit">Continue with Developer Login</button>
            </form>
          ) : (
            <a className="button-link" href={providerLoginUrl(activeProvider)}>
              Continue with {activeProvider}
            </a>
          )}
        </section>
      ) : null}

      {viewer && !bootstrapStatus?.initialized ? (
        <section className="panel">
          <h2>Initialize Workspace</h2>
          <p>First login must bootstrap the hub and default channel.</p>
          <form onSubmit={handleBootstrap} className="stack">
            <label htmlFor="hub-name">Hub Name</label>
            <input
              id="hub-name"
              value={hubName}
              onChange={(event) => setHubName(event.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
            <label htmlFor="setup-token">Setup Token</label>
            <input
              id="setup-token"
              value={setupToken}
              onChange={(event) => setSetupToken(event.target.value)}
              minLength={1}
              required
            />
            <button type="submit" disabled={bootstrapping}>
              {bootstrapping ? "Bootstrapping..." : "Bootstrap Admin + Hub"}
            </button>
          </form>
        </section>
      ) : null}

      {viewer && bootstrapStatus?.initialized ? (
        <section className="chat-shell" aria-label="Chat workspace">
          <nav className="servers panel" aria-label="Servers">
            <h2>Servers</h2>
            <ul>
              {servers.map((server) => (
                <li key={server.id}>
                  <button
                    type="button"
                    className={selectedServerId === server.id ? "list-item active" : "list-item"}
                    onClick={() => {
                      void handleServerChange(server.id);
                    }}
                  >
                    {server.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="channels panel" aria-label="Channels">
            <h2>Channels</h2>
            <ul>
              {channels.map((channel) => (
                <li key={channel.id}>
                  <button
                    type="button"
                    className={selectedChannelId === channel.id ? "list-item active" : "list-item"}
                    onClick={() => {
                      void handleChannelChange(channel.id);
                    }}
                  >
                    #{channel.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="timeline panel" aria-label="Messages">
            <h2>{activeChannel ? `#${activeChannel.name}` : "No channel selected"}</h2>
            <ol className="messages">
              {messages.map((message) => (
                <li key={message.id}>
                  <article>
                    <header>
                      <strong>{message.authorDisplayName}</strong>
                      <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                    </header>
                    <p>{message.content}</p>
                  </article>
                </li>
              ))}
            </ol>

            <form onSubmit={handleSendMessage} className="composer">
              <label htmlFor="message-input" className="sr-only">
                Message
              </label>
              <input
                id="message-input"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                maxLength={2000}
                placeholder={activeChannel ? `Message #${activeChannel.name}` : "Select a channel first"}
                disabled={!activeChannel || sending}
              />
              <button type="submit" disabled={!activeChannel || sending || !draftMessage.trim()}>
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
          </section>
        </section>
      ) : null}
    </main>
  );
}
