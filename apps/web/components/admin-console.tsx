"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  deleteDiscordBridgeMapping,
  assignSpaceOwner,
  listSpaceOwnerAssignments,
  revokeSpaceOwnerAssignment,
  transferSpaceOwnership,
  listDelegationAuditEvents,
  searchUsers,
  fetchAllowedActions,
  grantRole,
  createServer
} from "../lib/control-plane";
import { DelegationAuditEvent, SpaceOwnerAssignment, Server, IdentityMapping, PrivilegedAction } from "@escapehatch/shared";



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

  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [delegations, setDelegations] = useState<SpaceOwnerAssignment[]>([]);
  const [auditEvents, setAuditEvents] = useState<DelegationAuditEvent[]>([]);
  const [newDelegateUserId, setNewDelegateUserId] = useState("");
  const [newDelegateExpiresAt, setNewDelegateExpiresAt] = useState("");
  const [newOwnerUserId, setNewOwnerUserId] = useState("");

  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceInitialOwnerId, setNewSpaceInitialOwnerId] = useState("");

  const [userQuery, setUserQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IdentityMapping[]>([]);
  const [previewPermissions, setPreviewPermissions] = useState<PrivilegedAction[]>([]);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);



  const selectedHubName = useMemo(
    () => hubs.find((hub) => hub.id === selectedHubId)?.name ?? selectedHubId,
    [hubs, selectedHubId]
  );

  async function loadHubState(hubId: string): Promise<void> {
    const [policy, bridge, mappingItems, serverItems, auditItems] = await Promise.all([
      fetchFederationPolicy(hubId),
      fetchDiscordBridgeHealth(hubId),
      listDiscordBridgeMappings(hubId),
      listServers(),
      listDelegationAuditEvents(hubId)
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
    setAuditEvents(auditItems);

    const hubServers = serverItems.filter((server) => server.hubId === hubId);
    setServers(hubServers);
    const serverIds = new Set(hubServers.map((server) => server.id));
    const channelsPerServer = await Promise.all([...serverIds].map((serverId) => listChannels(serverId)));
    setChannels(
      channelsPerServer
        .flat()
        .map((channel) => ({ id: channel.id, name: `#${channel.name}` }))
    );

    if (hubServers.length > 0 && hubServers[0]) {
      const firstServerId = hubServers[0].id;
      setSelectedServerId(firstServerId);
      await loadServerState(firstServerId);
    }
  }

  async function loadServerState(serverId: string): Promise<void> {
    const assigned = await listSpaceOwnerAssignments(serverId);
    setDelegations(assigned);
    if (previewUserId) {
      await loadPreview(serverId, previewUserId);
    }
  }

  async function loadPreview(serverId: string, userId: string): Promise<void> {
    try {
      const actions = await fetchAllowedActions(serverId, undefined, userId);
      setPreviewPermissions(actions);
    } catch (cause) {
      console.warn("Failed to load permission preview:", cause);
      setPreviewPermissions([]);
    }
  }

  async function handleUserSearch(query: string): Promise<void> {
    setUserQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await searchUsers(query);
      setSearchResults(results);
    } catch (cause) {
      console.error("User search failed:", cause);
    }
  }

  async function handleSelectUser(user: IdentityMapping): Promise<void> {
    setNewDelegateUserId(user.productUserId);
    setNewOwnerUserId(user.productUserId);
    setPreviewUserId(user.productUserId);
    setSearchResults([]);
    setUserQuery(user.preferredUsername || user.email || user.productUserId);
    if (selectedServerId) {
      await loadPreview(selectedServerId, user.productUserId);
    }
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
          roleBindings.some((binding) => binding.role === "hub_admin")
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

  async function handleServerChange(serverId: string): Promise<void> {
    setSelectedServerId(serverId);
    await loadServerState(serverId);
  }

  async function handleAddDelegate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedServerId || !newDelegateUserId) return;
    setBusy(true);
    try {
      await assignSpaceOwner({
        serverId: selectedServerId,
        productUserId: newDelegateUserId,
        expiresAt: newDelegateExpiresAt || undefined
      });
      setNewDelegateUserId("");
      setNewDelegateExpiresAt("");
      await loadServerState(selectedServerId);
      await loadHubState(selectedHubId); // refresh audit
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to add delegate.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeDelegate(assignmentId: string): Promise<void> {
    if (!selectedServerId) return;
    setBusy(true);
    try {
      await revokeSpaceOwnerAssignment({ serverId: selectedServerId, assignmentId });
      await loadServerState(selectedServerId);
      await loadHubState(selectedHubId); // refresh audit
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to revoke delegate.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransferOwnership(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedServerId || !newOwnerUserId) return;
    if (!window.confirm("Are you sure you want to transfer ownership? This action is irreversible.")) return;
    setBusy(true);
    try {
      await transferSpaceOwnership({ serverId: selectedServerId, newOwnerUserId });
      setNewOwnerUserId("");
      await loadServerState(selectedServerId);
      await loadHubState(selectedHubId); // refresh audit and server list
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to transfer ownership.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateSpace(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedHubId || !newSpaceName.trim()) return;
    setBusy(true);
    try {
      const server = await createServer({
        hubId: selectedHubId,
        name: newSpaceName.trim()
      });
      if (newSpaceInitialOwnerId.trim()) {
        await transferSpaceOwnership({
          serverId: server.id,
          newOwnerUserId: newSpaceInitialOwnerId.trim()
        });
      }
      setNewSpaceName("");
      setNewSpaceInitialOwnerId("");
      await loadHubState(selectedHubId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create space.");
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
        <div className="topbar-meta">
          <Link href="/" className="ghost">Back to Chat</Link>
        </div>
      </header>
      <div className="scrollable-area">
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

          <h3>Create New Space (Server)</h3>
          <form className="stack" onSubmit={handleCreateSpace}>
            <label htmlFor="new-space-name">Space Name</label>
            <input
              id="new-space-name"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              required
              placeholder="e.g. Community A"
            />
            <label htmlFor="new-space-owner">Initial Owner ID (Optional)</label>
            <input
              id="new-space-owner"
              value={newSpaceInitialOwnerId}
              onChange={(e) => setNewSpaceInitialOwnerId(e.target.value)}
              placeholder="usr_..."
            />
            <button type="submit" disabled={busy || !selectedHubId}>
              Create Space
            </button>
          </form>
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

        <section className="panel stack">
          <h2>Space Delegation & Ownership</h2>
          <label htmlFor="server-select-admin">Select Server</label>
          <select
            id="server-select-admin"
            value={selectedServerId}
            onChange={(event) => {
              void handleServerChange(event.target.value);
            }}
          >
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name} ({server.id})
              </option>
            ))}
          </select>

          <h3>Delegated Admins (Space Owners)</h3>
          {delegations.length > 0 ? (
            <table className="voice-presence-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {delegations.map((d) => (
                  <tr key={d.id}>
                    <td>{d.assignedUserId}</td>
                    <td>{d.status}</td>
                    <td>{d.expiresAt ? new Date(d.expiresAt).toLocaleString() : "Never"}</td>
                    <td>
                      {d.status === "active" && (
                        <button
                          type="button"
                          className="ghost danger"
                          onClick={() => {
                            if (confirm("Revoke this delegation?")) {
                              void handleRevokeDelegate(d.id);
                            }
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No delegated admins for this server.</p>
          )}

          <div className="panel stack" style={{ border: "1px solid var(--border)", backgroundColor: "rgba(0,0,0,0.1)" }}>
            <h3>Assign New Delegate</h3>
            <div className="stack" style={{ position: "relative" }}>
              <label htmlFor="user-picker">Search User (Username or Email)</label>
              <input
                id="user-picker"
                value={userQuery}
                onChange={(e) => void handleUserSearch(e.target.value)}
                placeholder="Search..."
                autoComplete="off"
              />
              {searchResults.length > 0 && (
                <ul className="search-results-dropdown">
                  {searchResults.map((user) => (
                    <li key={user.productUserId} onClick={() => void handleSelectUser(user)}>
                      {user.preferredUsername || "Unknown"} ({user.email || user.productUserId})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {previewUserId && (
              <div className="stack" style={{ marginTop: "1rem" }}>
                <h4>Permissions Preview for {userQuery}</h4>
                <div className="permissions-grid">
                  {previewPermissions.length > 0 ? (
                    previewPermissions.map((action) => (
                      <span key={action} className="pill">
                        {action}
                      </span>
                    ))
                  ) : (
                    <p>No special permissions assigned in this scope.</p>
                  )}
                </div>
              </div>
            )}

            <form className="stack" onSubmit={handleAddDelegate} style={{ marginTop: "1rem" }}>
              <input type="hidden" value={newDelegateUserId} required />
              <label htmlFor="delegate-expires-at">Expiration (Optional)</label>
              <input
                id="delegate-expires-at"
                type="datetime-local"
                value={newDelegateExpiresAt}
                onChange={(e) => setNewDelegateExpiresAt(e.target.value)}
              />
              <button type="submit" disabled={busy || !selectedServerId || !newDelegateUserId}>
                Confirm Assignment
              </button>
            </form>
          </div>

          <h3>Transfer Server Ownership</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            <strong>Warning:</strong> Transferring ownership will remove your owner status for this server.
          </p>
          <form className="stack" onSubmit={handleTransferOwnership}>
            <label htmlFor="new-owner-user-id">New Owner (Search above first)</label>
            <input
              id="new-owner-user-id"
              value={newOwnerUserId}
              onChange={(e) => setNewOwnerUserId(e.target.value)}
              required
              placeholder="Assign a user above or paste ID"
            />
            <button
              type="submit"
              className="danger"
              disabled={busy || !selectedServerId}
              onClick={(e) => {
                if (!confirm("Are you sure you want to transfer ownership? This cannot be undone easily.")) {
                  e.preventDefault();
                }
              }}
            >
              Transfer Ownership
            </button>
          </form>
        </section>

        <section className="panel stack">
          <h2>Delegation Audit Log</h2>
          {auditEvents.length > 0 ? (
            <table className="voice-presence-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleString()}</td>
                    <td>{e.actionType}</td>
                    <td>{e.actorUserId}</td>
                    <td>{e.targetUserId || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No audit events found.</p>
          )}
        </section>
      </div>
    </main>
  );
}
