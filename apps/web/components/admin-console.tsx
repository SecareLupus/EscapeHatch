"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  discordBridgeStartUrl,
  fetchDiscordBridgeHealth,
  fetchDiscordBridgePendingSelection,
  fetchFederationPolicy,
  fetchViewerSession,
  listChannels,
  listDiscordBridgeMappings,
  listHubs,
  listServers,
  listViewerRoleBindings,
  reconcileFederationPolicy,
  retryDiscordBridgeSyncAction,
  selectDiscordBridgeGuild,
  updateFederationPolicy,
  upsertDiscordBridgeMapping,
  deleteDiscordBridgeMapping
} from "../lib/control-plane";

export function AdminConsole() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hubs, setHubs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>("");
  const [canManage, setCanManage] = useState(false);
  const [federationAllowlist, setFederationAllowlist] = useState("");
  const [federationStatus, setFederationStatus] = useState<{
    totalRooms: number;
    appliedRooms: number;
    errorRooms: number;
    skippedRooms: number;
  } | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{
    connection: {
      guildId: string | null;
      guildName: string | null;
      status: "disconnected" | "connected" | "degraded" | "syncing";
      lastSyncAt: string | null;
      lastError: string | null;
    } | null;
    mappingCount: number;
    activeMappingCount: number;
  } | null>(null);
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [mappings, setMappings] = useState<
    Array<{ id: string; discordChannelId: string; discordChannelName: string; matrixChannelId: string }>
  >([]);
  const [discordPendingSelectionId, setDiscordPendingSelectionId] = useState<string | null>(null);
  const [discordGuilds, setDiscordGuilds] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [discordChannelName, setDiscordChannelName] = useState("");
  const [matrixChannelId, setMatrixChannelId] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedHubName = useMemo(
    () => hubs.find((hub) => hub.id === selectedHubId)?.name ?? selectedHubId,
    [hubs, selectedHubId]
  );

  async function loadHubState(hubId: string): Promise<void> {
    const [policy, bridge, mappingItems, serverItems] = await Promise.all([
      fetchFederationPolicy(hubId),
      fetchDiscordBridgeHealth(hubId),
      listDiscordBridgeMappings(hubId),
      listServers()
    ]);
    setFederationAllowlist(policy.policy?.allowlist.join(", ") ?? "");
    setFederationStatus(policy.status);
    setBridgeStatus(bridge);
    setMappings(
      mappingItems.map((item) => ({
        id: item.id,
        discordChannelId: item.discordChannelId,
        discordChannelName: item.discordChannelName,
        matrixChannelId: item.matrixChannelId
      }))
    );

    const serverIds = new Set(serverItems.filter((server) => server.hubId === hubId).map((server) => server.id));
    const channelsPerServer = await Promise.all([...serverIds].map((serverId) => listChannels(serverId)));
    setChannels(
      channelsPerServer
        .flat()
        .map((channel) => ({ id: channel.id, name: `#${channel.name}` }))
    );
  }

  useEffect(() => {
    const pending = new URLSearchParams(window.location.search).get("discordPendingSelection");
    if (pending) {
      setDiscordPendingSelectionId(pending);
    }
  }, []);

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const [viewer, roleBindings, hubItems] = await Promise.all([
          fetchViewerSession(),
          listViewerRoleBindings(),
          listHubs()
        ]);
        if (!viewer) {
          setCanManage(false);
          setHubs([]);
          return;
        }
        setCanManage(
          roleBindings.some((binding) => binding.role === "creator_admin" || binding.role === "hub_operator")
        );
        const mappedHubs = hubItems.map((hub) => ({ id: hub.id, name: hub.name }));
        setHubs(mappedHubs);
        const firstHub = mappedHubs[0]?.id ?? "";
        setSelectedHubId(firstHub);
        if (firstHub) {
          await loadHubState(firstHub);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to load admin console.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!discordPendingSelectionId) {
      setDiscordGuilds([]);
      return;
    }
    void fetchDiscordBridgePendingSelection(discordPendingSelectionId)
      .then((pending) => {
        setDiscordGuilds(pending.guilds);
        setSelectedGuildId((current) => current || pending.guilds[0]?.id || "");
        if (!selectedHubId) {
          setSelectedHubId(pending.hubId);
        }
      })
      .catch(() => {
        setDiscordPendingSelectionId(null);
        setDiscordGuilds([]);
      });
  }, [discordPendingSelectionId, selectedHubId]);

  async function handleHubChange(nextHubId: string): Promise<void> {
    setSelectedHubId(nextHubId);
    setError(null);
    try {
      await loadHubState(nextHubId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load selected hub.");
    }
  }

  async function handleSaveFederation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedHubId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const allowlist = federationAllowlist.split(",").map((item) => item.trim()).filter(Boolean);
      await updateFederationPolicy({ hubId: selectedHubId, allowlist });
      await loadHubState(selectedHubId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save federation policy.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReconcileFederation(): Promise<void> {
    if (!selectedHubId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reconcileFederationPolicy(selectedHubId);
      await loadHubState(selectedHubId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to reconcile federation.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectGuild(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!discordPendingSelectionId || !selectedGuildId || !selectedHubId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await selectDiscordBridgeGuild({
        pendingSelectionId: discordPendingSelectionId,
        guildId: selectedGuildId
      });
      setDiscordPendingSelectionId(null);
      await loadHubState(selectedHubId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to select Discord guild.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryBridge(): Promise<void> {
    if (!selectedHubId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await retryDiscordBridgeSyncAction(selectedHubId);
      await loadHubState(selectedHubId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to retry bridge sync.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpsertMapping(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedHubId || !bridgeStatus?.connection?.guildId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertDiscordBridgeMapping({
        hubId: selectedHubId,
        guildId: bridgeStatus.connection.guildId,
        discordChannelId,
        discordChannelName,
        matrixChannelId,
        enabled: true
      });
      setDiscordChannelId("");
      setDiscordChannelName("");
      setMatrixChannelId("");
      await loadHubState(selectedHubId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save mapping.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMapping(mappingId: string): Promise<void> {
    if (!selectedHubId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteDiscordBridgeMapping({ hubId: selectedHubId, mappingId });
      await loadHubState(selectedHubId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete mapping.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="app">
        <section className="panel">
          <h1>Admin Console</h1>
          <p>Loading...</p>
        </section>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="app">
        <section className="panel">
          <h1>Admin Console</h1>
          <p>You do not currently have hub admin scope.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="topbar">
        <h1>Federation + Discord Bridge Admin</h1>
      </header>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="panel stack">
        <label htmlFor="hub-select-admin">Hub</label>
        <select
          id="hub-select-admin"
          value={selectedHubId}
          onChange={(event) => {
            void handleHubChange(event.target.value);
          }}
        >
          {hubs.map((hub) => (
            <option key={hub.id} value={hub.id}>
              {hub.name}
            </option>
          ))}
        </select>
        <p>Selected hub: {selectedHubName}</p>
      </section>

      <section className="panel stack">
        <h2>Federation Policy</h2>
        <form className="stack" onSubmit={handleSaveFederation}>
          <label htmlFor="federation-allowlist-admin">Allowlist</label>
          <input
            id="federation-allowlist-admin"
            value={federationAllowlist}
            onChange={(event) => setFederationAllowlist(event.target.value)}
            placeholder="matrix.example.org, hub.partner.net"
          />
          <div className="voice-actions">
            <button type="submit" disabled={busy}>
              Save Policy
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => void handleReconcileFederation()}>
              Reconcile
            </button>
          </div>
        </form>
        {federationStatus ? (
          <p>
            Applied {federationStatus.appliedRooms}/{federationStatus.totalRooms} rooms. Errors:{" "}
            {federationStatus.errorRooms}.
          </p>
        ) : null}
      </section>

      <section className="panel stack">
        <h2>Discord Bridge</h2>
        {selectedHubId ? (
          <a className="button-link" href={discordBridgeStartUrl(selectedHubId)}>
            Connect Discord
          </a>
        ) : null}
        <p>
          Status: {bridgeStatus?.connection?.status ?? "disconnected"}
          {bridgeStatus?.connection?.guildName ? ` (${bridgeStatus.connection.guildName})` : ""}
        </p>
        <button type="button" className="ghost" disabled={busy || !selectedHubId} onClick={() => void handleRetryBridge()}>
          Retry Sync
        </button>

        {discordPendingSelectionId && discordGuilds.length > 0 ? (
          <form className="stack" onSubmit={handleSelectGuild}>
            <label htmlFor="guild-select-admin">Select Guild</label>
            <select
              id="guild-select-admin"
              value={selectedGuildId}
              onChange={(event) => setSelectedGuildId(event.target.value)}
            >
              {discordGuilds.map((guild) => (
                <option key={guild.id} value={guild.id}>
                  {guild.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={busy}>
              Confirm Guild
            </button>
          </form>
        ) : null}

        <form className="stack" onSubmit={handleUpsertMapping}>
          <label htmlFor="discord-channel-id-admin">Discord Channel ID</label>
          <input
            id="discord-channel-id-admin"
            value={discordChannelId}
            onChange={(event) => setDiscordChannelId(event.target.value)}
            required
          />
          <label htmlFor="discord-channel-name-admin">Discord Channel Name</label>
          <input
            id="discord-channel-name-admin"
            value={discordChannelName}
            onChange={(event) => setDiscordChannelName(event.target.value)}
            required
          />
          <label htmlFor="matrix-channel-id-admin">Matrix Channel</label>
          <select
            id="matrix-channel-id-admin"
            value={matrixChannelId}
            onChange={(event) => setMatrixChannelId(event.target.value)}
            required
          >
            <option value="">Select channel</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy || !bridgeStatus?.connection?.guildId}>
            Save Mapping
          </button>
        </form>

        {mappings.length > 0 ? (
          <ul>
            {mappings.map((mapping) => (
              <li key={mapping.id}>
                {mapping.discordChannelName} ({mapping.discordChannelId}) → {mapping.matrixChannelId}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    void handleDeleteMapping(mapping.id);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No channel mappings configured yet.</p>
        )}
      </section>
    </main>
  );
}
